import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { runMock } = vi.hoisted(() => ({ runMock: vi.fn() }));
vi.mock('../../src/run', () => ({ run: runMock }));

import { handleRun } from '../../src/ui/worker';

let sent: any[];
const notify = async (message: object) => { sent.push(message); };

beforeEach(() => {
    runMock.mockReset();
    sent = [];
    process.exitCode = undefined;
});

afterEach(() => {
    process.exitCode = undefined;
});

test('runs tests with overrides from ui server and reports result', async () => {
    runMock.mockImplementation(async () => { process.exitCode = 0; });
    const overrides = { paths: ['a.feature:3'], skipExecutionHooks: true };
    await handleRun(overrides, notify);
    expect(runMock).toHaveBeenCalledWith(expect.objectContaining({ runCucumber: expect.any(Function) }), overrides);
    expect(sent).toEqual([{ type: 'done', success: true }]);
});

test('reports failed run', async () => {
    runMock.mockImplementation(async () => { process.exitCode = 1; });
    await handleRun({}, notify);
    expect(sent).toEqual([{ type: 'done', success: false }]);
});

test('reports fatal error with stack', async () => {
    runMock.mockRejectedValue(new Error('config is broken'));
    await handleRun({}, notify);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('fatal');
    expect(sent[0].message).toContain('config is broken');
    expect(process.exitCode).toBe(1);
});
