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

/**
 * Execute a run requested by the ui server and report the outcome
 * @param overrides - run overrides sent by ui server
 * @param notify - sends result message to ui server
 */
export async function handleRun(overrides: RunOverrides, notify: (message: object) => Promise<void> = send): Promise<void> {
    try {
        const cucumber = await import('@cucumber/cucumber/api');
        await run(cucumber, overrides);
        await notify({ type: 'done', success: process.exitCode === 0 });
    } catch (err: any) {
        await notify({ type: 'fatal', message: err?.stack ?? String(err) });
        process.exitCode = 1;
    }
}

// only when forked as ui worker process (not when imported)
if (require.main === module) {
    process.once('message', async (overrides: RunOverrides) => {
        await handleRun(overrides);
        process.disconnect?.();
    });
}
