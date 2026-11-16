import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { runMock, startUiMock } = vi.hoisted(() => ({
    runMock: vi.fn(),
    startUiMock: vi.fn(),
}));

vi.mock('../src/run', () => ({ default: runMock }));

import { fail, main } from '../src/cli';
import { UsageError } from '../src/UsageError';
import { version } from '../package.json';

describe('cli main', () => {
    let log: ReturnType<typeof vi.spyOn>;
    let warn: ReturnType<typeof vi.spyOn>;
    let error: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        runMock.mockReset().mockResolvedValue(undefined);
        startUiMock.mockReset().mockResolvedValue(undefined);
        log = vi.spyOn(console, 'log').mockImplementation(() => {});
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        error = vi.spyOn(console, 'error').mockImplementation(() => {});
        process.exitCode = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.exitCode = undefined;
    });

    test.each([['--help'], ['-h'], ['help']])('%s prints help', async flag => {
        await main(['node', 'qavajs', flag]);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
        expect(runMock).not.toHaveBeenCalled();
    });

    test.each([['--version'], ['-v']])('%s prints version', async flag => {
        await main(['node', 'qavajs', flag]);
        expect(log).toHaveBeenCalledWith(version);
    });

    test('flags after -- are not treated as qavajs flags', async () => {
        await main(['node', 'qavajs', 'run', '--', '--help']);
        expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Usage:'));
        expect(runMock).toHaveBeenCalledTimes(1);
    });

    test('runs tests by default and with run command', async () => {
        await main(['node', 'qavajs', '--config', 'config.js']);
        await main(['node', 'qavajs', 'run', '--config', 'config.js']);
        expect(runMock).toHaveBeenCalledTimes(2);
    });

    test('feature path in command position is not an unknown command', async () => {
        await main(['node', 'qavajs', 'features/a.feature']);
        expect(runMock).toHaveBeenCalledTimes(1);
    });

    test('ui command starts ui with argv', async () => {
        const argv = ['node', 'qavajs', 'ui', '--no-open'];
        await main(argv, { loadUi: () => ({ startUi: startUiMock }) as any });
        expect(startUiMock).toHaveBeenCalledWith(argv);
        expect(runMock).not.toHaveBeenCalled();
    });

    test('unknown command throws usage error', () => {
        expect(() => main(['node', 'qavajs', 'rnu'])).toThrow(UsageError);
        expect(() => main(['node', 'qavajs', 'rnu'])).toThrow("unknown command 'rnu'");
    });

    test('warns about mistyped flags', async () => {
        await main(['node', 'qavajs', '--confg', 'config.js']);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown option '--confg', did you mean '--config'?"));
    });

    test('run failures are reported and set exit code', async () => {
        runMock.mockRejectedValue(new UsageError('bad config'));
        await main(['node', 'qavajs']);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('bad config'));
        expect(process.exitCode).toBe(1);
    });

    test('fail prints unexpected errors with stack', () => {
        const err = new Error('boom');
        fail(err);
        expect(error).toHaveBeenCalledWith(err);
        expect(process.exitCode).toBe(1);
    });
});
