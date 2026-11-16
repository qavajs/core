import { After, Before } from '@cucumber/cucumber';
import type { IQavajsWorld } from './IQavajsWorld';

type Teardown = (this: IQavajsWorld) => unknown;
/** setup may return a teardown function (checked at runtime) */
type Setup = (this: IQavajsWorld) => unknown;

function withContext(err: unknown, context: string): Error {
    if (err instanceof Error) {
        err.message = `${context}: ${err.message}`;
        return err;
    }
    return new Error(`${context}: ${String(err)}`, { cause: err });
}

/**
 * Define fixture: setup runs before each matching scenario, the function it returns runs after it
 * @param params.name - fixture name (used in hook names and error messages)
 * @param params.tags - tag expression to filter scenarios
 * @param fn - setup function, may return teardown function
 * @example
 * Fixture({ name: 'server', tags: '@server' }, async function () {
 *     const server = await startServer();
 *     return () => server.stop();
 * });
 */
export function Fixture(params: { name: string, tags?: string }, fn: Setup) {
    const name = params.name;
    if (!name) { throw new Error('Fixture name is required'); }
    const tags = params.tags;
    const key = `__fixtureTearDown_${name}`;
    Before({ name: `setup ${name}`, tags }, async function(this: any) {
        let teardown: unknown;
        try {
            teardown = await fn.call(this);
        } catch (err) {
            // no teardown is registered: setup is responsible for releasing what it acquired before failing
            throw withContext(err, `Fixture '${name}' setup failed, teardown will not run`);
        }
        if (teardown !== undefined && typeof teardown !== 'function') {
            throw new Error(`Fixture '${name}' setup must return a teardown function or nothing, got ${typeof teardown}`);
        }
        this[key] = teardown;
    });
    After({ name: `teardown ${name}`, tags }, async function(this: any) {
        const teardown = this[key] as Teardown | undefined;
        delete this[key];
        if (!teardown) return;
        try {
            await teardown.call(this);
        } catch (err) {
            throw withContext(err, `Fixture '${name}' teardown failed`);
        }
    });
}
