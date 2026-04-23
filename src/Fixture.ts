import { After, Before } from '@cucumber/cucumber';

export function Fixture(params: { name: string, tags?: string }, fn: () => Promise<unknown>) {
    const name = params.name;
    if (!name) { throw new Error('Fixture name is required'); }
    const tags = params.tags;
    const key = `__fixtureTearDown_${name}`;
    Before({ name: `setup ${name}`, tags }, async function(this: any) {
        this[key] = await fn.bind(this)() as () => Promise<unknown>;
    });
    After({ name: `teardown ${name}`, tags }, async function(this: any) {
        if (this[key]) {
            await (this[key] as () => Promise<unknown>).bind(this)();
        }
    });
}