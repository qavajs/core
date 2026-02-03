import { After, Before } from '@cucumber/cucumber';

export function Fixture(params: { name: string, tags?: string }, fn: () => Promise<unknown>) {
    const name = params.name;
    if (!name) { throw new Error('Fixture name is required'); }
    const tags = params.tags;
    let fixtureTearDown: () => Promise<unknown>;
    Before({ name: `setup ${name}`, tags }, async function(this) {
        fixtureTearDown = await fn.bind(this)() as () => Promise<unknown>;
    });
    After({ name: `teardown ${name}`, tags }, async function (this) {
        if (fixtureTearDown) {
            await fixtureTearDown.bind(this)();
        }
    });
}