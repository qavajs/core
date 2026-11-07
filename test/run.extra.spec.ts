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
    vi.mocked(importConfig).mockResolvedValue({ service: [] });
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } },
    });
    await run(buildCucumberMock({ loadConfiguration: loadConfigurationMock }));
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.tags).toBe('(@smoke) and (@regression)');
});

test('single --tag is wrapped in parens', async () => {
    process.argv.push('--config', 'config.ts', '--tags', '@smoke');
    vi.mocked(importConfig).mockResolvedValue({ service: [] });
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } },
    });
    await run(buildCucumberMock({ loadConfiguration: loadConfigurationMock }));
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.tags).toBe('(@smoke)');
});

test('formats.files entries are logged to console', async () => {
    process.argv.push('--config', 'config.ts');
    vi.mocked(importConfig).mockResolvedValue({ service: [] });
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
    vi.mocked(importConfig).mockResolvedValue({ service: [] });
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
    vi.mocked(importConfig).mockResolvedValue({ service: [] });
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

test('auto-discovers config.ts when no --config provided', async () => {
    vi.mocked(existsSync).mockReturnValueOnce(true);
    vi.mocked(importConfig).mockResolvedValue({ service: [] });
    await run(buildCucumberMock());
    expect(importConfig).toHaveBeenCalledWith('config.ts', expect.any(String));
});

test('auto-discovers config.js when config.ts is not found', async () => {
    vi.mocked(existsSync).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.mocked(importConfig).mockResolvedValue({ service: [] });
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
        service: [],
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
