import { run, RunOverrides } from '../run';

/**
 * Child process entry of ui mode.
 * Receives run overrides from the ui server and executes a regular qavajs run.
 */
function send(message: object): Promise<void> {
    return new Promise(resolve => {
        if (!process.send) return resolve();
        process.send(message, () => resolve());
    });
}

process.once('message', async (overrides: RunOverrides) => {
    try {
        const cucumber = await import('@cucumber/cucumber/api');
        await run(cucumber, overrides);
        await send({ type: 'done', success: process.exitCode === 0 });
    } catch (err: any) {
        await send({ type: 'fatal', message: err?.stack ?? String(err) });
        process.exitCode = 1;
    }
    process.disconnect?.();
});
