import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { run } from '../src/run';
import { importConfig } from '../src/importConfig';
import { existsSync } from 'node:fs';

vi.mock('../src/importConfig');
vi.mock('node:fs', () => ({ existsSync: vi.fn() }));

let originalArgv: string[];

beforeEach(() => {
    originalArgv = [...process.argv];
    process.argv = ['node', 'script'];
    vi.resetAllMocks();
    vi.useRealTimers();
});

afterEach(() => {
    process.argv = originalArgv;
});

const defaultSupportMock = {
    beforeTestRunHookDefinitions: [],
    afterTestRunHookDefinitions: [],
};

function buildCucumberMock(overrides: any = {}) {
    return {
        runCucumber: vi.fn().mockReturnValue({ success: true }),
        loadConfiguration: vi.fn().mockReturnValue({
            runConfiguration: { support: { requireModules: [] } },
        }),
        loadSources: vi.fn().mockReturnValue({ plan: [] }),
        loadSupport: vi.fn().mockReturnValue(defaultSupportMock),
        ...overrides,
    };
}

test('merges multiple --tags with and', async () => {
    process.argv.push('--config', 'config.ts', '--tags', '@smoke', '--tags', '@regression');
    vi.mocked(importConfig).mockResolvedValue({});
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } },
    });
    await run(buildCucumberMock({ loadConfiguration: loadConfigurationMock }));
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.tags).toBe('(@smoke) and (@regression)');
});

test('single --tag is wrapped in parens', async () => {
    process.argv.push('--config', 'config.ts', '--tags', '@smoke');
    vi.mocked(importConfig).mockResolvedValue({});
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } },
    });
    await run(buildCucumberMock({ loadConfiguration: loadConfigurationMock }));
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.tags).toBe('(@smoke)');
});

test('formats.files entries are logged to console', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: {
            support: { requireModules: [] },
            formats: { files: { 'reports/output.json': 'json' } },
        },
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(buildCucumberMock({ loadConfiguration: loadConfigurationMock }));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('json file://'));
    consoleSpy.mockRestore();
});

test('beforeExecutionHooks are called and excluded from support code', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const beforeHook = vi.fn();
    (beforeHook as any).isTestExecutionHook = true;
    const regularHook = vi.fn();
    const supportMock = {
        beforeTestRunHookDefinitions: [{ code: beforeHook }, { code: regularHook }],
        afterTestRunHookDefinitions: [],
    };
    await run(buildCucumberMock({ loadSupport: vi.fn().mockReturnValue(supportMock) }));
    expect(beforeHook).toHaveBeenCalledTimes(1);
    expect(regularHook).not.toHaveBeenCalled();
});

test('afterExecutionHooks are called and excluded from support code', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const afterHook = vi.fn();
    (afterHook as any).isTestExecutionHook = true;
    const regularHook = vi.fn();
    const supportMock = {
        beforeTestRunHookDefinitions: [],
        afterTestRunHookDefinitions: [{ code: afterHook }, { code: regularHook }],
    };
    await run(buildCucumberMock({ loadSupport: vi.fn().mockReturnValue(supportMock) }));
    expect(afterHook).toHaveBeenCalledTimes(1);
    expect(regularHook).not.toHaveBeenCalled();
});

function executionHook(fn: () => any) {
    return { code: Object.assign(vi.fn(fn), { isTestExecutionHook: true }) };
}

test('BeforeExecution hooks run sequentially in order, AfterExecution in reverse order', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const calls: string[] = [];
    const tracked = (name: string) => executionHook(async () => {
        calls.push(`${name}:start`);
        await new Promise(resolve => setTimeout(resolve, name.endsWith('1') ? 20 : 0));
        calls.push(`${name}:end`);
    });
    const supportMock = {
        beforeTestRunHookDefinitions: [tracked('before1'), tracked('before2')],
        afterTestRunHookDefinitions: [tracked('after1'), tracked('after2')],
    };
    await run(buildCucumberMock({ loadSupport: vi.fn().mockReturnValue(supportMock) }));
    expect(calls).toEqual([
        'before1:start', 'before1:end', 'before2:start', 'before2:end',
        'after2:start', 'after2:end', 'after1:start', 'after1:end',
    ]);
});

test('AfterExecution hooks run when the test run crashes and the original error is rethrown', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const afterHook = executionHook(() => {});
    const supportMock = {
        beforeTestRunHookDefinitions: [],
        afterTestRunHookDefinitions: [afterHook],
    };
    const runError = new Error('runCucumber crashed');
    await expect(run(buildCucumberMock({
        loadSupport: vi.fn().mockReturnValue(supportMock),
        loadSources: vi.fn().mockReturnValue({ plan: [{}] }),
        runCucumber: vi.fn().mockRejectedValue(runError),
    }))).rejects.toBe(runError);
    expect(afterHook.code).toHaveBeenCalledTimes(1);
});

test('failing BeforeExecution hook stops setup, skips the run and still runs teardown', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const setupError = new Error('setup failed');
    const failingBefore = executionHook(() => { throw setupError; });
    const nextBefore = executionHook(() => {});
    const failingAfter = executionHook(() => { throw new Error('teardown failed'); });
    const afterHook = executionHook(() => {});
    const supportMock = {
        beforeTestRunHookDefinitions: [failingBefore, nextBefore],
        afterTestRunHookDefinitions: [afterHook, failingAfter],
    };
    const cucumber = buildCucumberMock({ loadSupport: vi.fn().mockReturnValue(supportMock) });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(run(cucumber)).rejects.toBe(setupError);
    expect(nextBefore.code).not.toHaveBeenCalled();
    expect(cucumber.runCucumber).not.toHaveBeenCalled();
    expect(afterHook.code).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('AfterExecution hook failed'), expect.any(Error));
    errorSpy.mockRestore();
});

test('all AfterExecution hooks run even if one fails, and failures are reported', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const teardownError = new Error('teardown failed');
    const afterHook = executionHook(() => {});
    const supportMock = {
        beforeTestRunHookDefinitions: [],
        afterTestRunHookDefinitions: [afterHook, executionHook(() => { throw teardownError; })],
    };
    await expect(run(buildCucumberMock({ loadSupport: vi.fn().mockReturnValue(supportMock) }))).rejects.toBe(teardownError);
    expect(afterHook.code).toHaveBeenCalledTimes(1);
});

test('multiple AfterExecution failures are combined into AggregateError', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const supportMock = {
        beforeTestRunHookDefinitions: [],
        afterTestRunHookDefinitions: [
            executionHook(() => { throw new Error('a'); }),
            executionHook(() => { throw new Error('b'); }),
        ],
    };
    const error = await run(buildCucumberMock({ loadSupport: vi.fn().mockReturnValue(supportMock) })).catch(err => err);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors.map((e: Error) => e.message)).toEqual(['b', 'a']);
});

test('auto-discovers config.ts when no --config provided', async () => {
    vi.mocked(existsSync).mockReturnValueOnce(true);
    vi.mocked(importConfig).mockResolvedValue({});
    await run(buildCucumberMock());
    expect(importConfig).toHaveBeenCalledWith('config.ts', expect.any(String));
});

test('auto-discovers config.js when config.ts is not found', async () => {
    vi.mocked(existsSync).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.mocked(importConfig).mockResolvedValue({});
    await run(buildCucumberMock());
    expect(importConfig).toHaveBeenCalledWith('config.js', expect.any(String));
});

test('throws No config provided when neither config file exists', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    await expect(run(buildCucumberMock())).rejects.toThrow('No config provided');
});

test('deep merges nested config formatOptions with CLI formatOptions', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({

        formatOptions: { colorsEnabled: true, snippetSyntax: 'async' },
    });
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } },
    });
    await run(buildCucumberMock({ loadConfiguration: loadConfigurationMock }));
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.formatOptions).toMatchObject({
        colorsEnabled: true,
        snippetSyntax: 'async',
    });
});

test('auto-discovers config.mjs and config.cjs', async () => {
    vi.mocked(existsSync).mockImplementation(path => path === './config.cjs');
    vi.mocked(importConfig).mockResolvedValue({});
    await run(buildCucumberMock());
    expect(importConfig).toHaveBeenCalledWith('config.cjs', expect.any(String));
});

test('No config provided error lists looked up files', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    await expect(run(buildCucumberMock())).rejects.toThrow(/config\.ts, config\.js, config\.mjs, config\.cjs.*--config <path>/);
});

test('parses and merges --format-options and --world-parameters from cli', async () => {
    process.argv.push(
        '--config', 'config.ts',
        '--format-options', '{"a":1}', '--format-options', '{"b":2}',
        '--world-parameters', '{"x":1}'
    );
    vi.mocked(importConfig).mockResolvedValue({ formatOptions: { c: 3 } });
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } },
    });
    await run(buildCucumberMock({ loadConfiguration: loadConfigurationMock }));
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.formatOptions).toEqual({ a: 1, b: 2, c: 3 });
    expect(options.provided.worldParameters).toEqual({ x: 1 });
});

test.each([
    ['--world-parameters', '{bad'],
    ['--format-options', 'nope'],
    ['--memory-values', '{"a":'],
])('throws readable error for invalid json in %s', async (flag, value) => {
    process.argv.push('--config', 'config.ts', flag, value);
    vi.mocked(importConfig).mockResolvedValue({});
    await expect(run(buildCucumberMock())).rejects.toThrow(`${flag} must be valid JSON`);
});

test('--quiet does not print config table', async () => {
    process.argv.push('--config', 'config.ts', '--quiet');
    vi.mocked(importConfig).mockResolvedValue({});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(buildCucumberMock());
    expect(log.mock.calls.flat().join('\n')).not.toContain('@qavajs/core');
    log.mockRestore();
});

test('config table has no colors when NO_COLOR is set', async () => {
    process.argv.push('--config', 'config.ts');
    process.env.NO_COLOR = '1';
    vi.mocked(importConfig).mockResolvedValue({});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
        await run(buildCucumberMock());
        const output = log.mock.calls.flat().join('\n');
        expect(output).toContain('@qavajs/core');
        expect(output).not.toContain('\x1b[');
    } finally {
        delete process.env.NO_COLOR;
        log.mockRestore();
    }
});

test('config from file is not mutated and memory instance is passed by reference', async () => {
    process.argv.push('--config', 'config.ts', '--format', 'progress', '--tags', '@smoke');
    class Memory { get value() { return 'proto'; } }
    const memory = new Memory();
    const config = { format: ['json:report.json'], tags: 'not @wip', memory };
    vi.mocked(importConfig).mockResolvedValue(config);
    const loadConfigurationMock = vi.fn().mockReturnValue({ runConfiguration: { support: { requireModules: [] } } });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(buildCucumberMock({ loadConfiguration: loadConfigurationMock }));
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.format).toEqual(['json:report.json', 'progress']);
    expect(options.provided.tags).toBe('(not @wip) and (@smoke)');
    expect(options.provided.memory).toBe(memory);
    expect(config).toEqual({ format: ['json:report.json'], tags: 'not @wip', memory });
});

test('coordinator flag is reset when loading support code fails', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({});
    const loadSupport = vi.fn().mockImplementation(async () => {
        expect(process.env.QAVAJS_COORDINATOR).toBe('1');
        throw new Error('syntax error in steps');
    });
    await expect(run(buildCucumberMock({ loadSupport }))).rejects.toThrow('syntax error in steps');
    expect(process.env.QAVAJS_COORDINATOR).toBe('0');
});
