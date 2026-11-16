import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const { spawnMock, sessions } = vi.hoisted(() => ({
    spawnMock: vi.fn(),
    sessions: [] as any[],
}));

vi.mock('node:child_process', async importOriginal => ({
    ...(await importOriginal<typeof import('node:child_process')>()),
    spawn: spawnMock,
}));

vi.mock('../../src/ui/session', async () => {
    const { EventEmitter } = await import('node:events');
    class UiSession extends EventEmitter {
        tree = [];
        attachments = new Map();
        discover = vi.fn().mockResolvedValue(undefined);
        dispose = vi.fn();
        snapshot = () => ({ tree: [], tests: [], run: { state: 'idle', testIds: [] }, output: [], error: null });
        isBusy = () => false;
        constructor(public options: any) {
            super();
            sessions.push(this);
        }
    }
    return { UiSession };
});

import { startUi } from '../../src/ui';

let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    sessions.length = 0;
    spawnMock.mockReset().mockImplementation(() => Object.assign(new EventEmitter(), { unref: vi.fn() }));
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    process.emit('SIGINT');
    vi.restoreAllMocks();
});

function printedUrl(): string {
    const line = logSpy.mock.calls.map(([text]) => String(text)).find(text => text.includes('is running at'))!;
    return line.match(/http:\/\/\S+/)![0];
}

test('starts server, discovers tests and passes run options to session', async () => {
    await startUi(['node', 'qavajs', 'ui', '--host', '127.0.0.1', '--no-open', '--config', 'config.js']);
    const [session] = sessions;
    expect(session.options.args).toEqual(['--config', 'config.js']);
    expect(session.discover).toHaveBeenCalledTimes(1);
    expect(spawnMock).not.toHaveBeenCalled();

    const response = await fetch(`${printedUrl()}/api/state`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tree: [], tests: [] });
});

test('opens browser unless --no-open is passed', async () => {
    await startUi(['node', 'qavajs', 'ui', '--host', '127.0.0.1']);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0][1]).toContain(printedUrl());
});

test('SIGINT disposes session and exits', async () => {
    await startUi(['node', 'qavajs', 'ui', '--host', '127.0.0.1', '--no-open']);
    vi.useFakeTimers();
    process.emit('SIGINT');
    vi.advanceTimersByTime(250);
    vi.useRealTimers();
    expect(sessions[0].dispose).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
});

test('rejects when port is taken', async () => {
    await startUi(['node', 'qavajs', 'ui', '--host', '127.0.0.1', '--no-open']);
    const port = new URL(printedUrl()).port;
    await expect(startUi(['node', 'qavajs', 'ui', '--host', '127.0.0.1', '--port', port, '--no-open']))
        .rejects.toThrow(/EADDRINUSE/);
});
