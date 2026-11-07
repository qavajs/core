import { test, beforeEach, vi, expect } from 'vitest';
import { run } from '../src/run';

import { importConfig } from '../src/importConfig';

vi.mock('../src/importConfig');

beforeEach(async () => {
    vi.resetAllMocks();
    vi.useRealTimers();
});

const supportMock = {
    beforeTestRunHookDefinitions: [],
    afterTestRunHookDefinitions: [],
}

test('exitCode=1 if scenario failed', async () => {
    process.argv.push('--config')
    process.argv.push('config.ts')
    vi.mocked(importConfig).mockReturnValue(Promise.resolve({
        service: []
    }));
    const cucumberMock = {
        runCucumber: vi.fn().mockReturnValue({ success: false }),
        loadConfiguration: vi.fn(() => {
            return {runConfiguration: {support: {requireModules: []}}}
        }),
        loadSources: vi.fn(() => {
            return {plan: [{}]}
        }),
        loadSupport: vi.fn(() => {
            return supportMock
        })
    };
    await run(cucumberMock);
    expect(process.exitCode).to.equal(1);
});

test('--paths from cli is passed to loadConfiguration', async () => {
    process.argv.push('--config');
    process.argv.push('config.ts');
    process.argv.push('--paths');
    process.argv.push('some/path/*.feature');
    vi.mocked(importConfig).mockResolvedValue({
        service: [],
        paths: ['config/*.feature']
    });
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } }
    });
    const cucumberMock = {
        runCucumber: vi.fn().mockReturnValue({ success: true }),
        loadConfiguration: loadConfigurationMock,
        loadSources: vi.fn().mockReturnValue({ plan: [] }),
        loadSupport: vi.fn().mockReturnValue(supportMock)
    };
    await run(cucumberMock);
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.paths).toEqual(['config/*.feature', 'some/path/*.feature']);
});

test('formatOptions from config is passed to loadConfiguration', async () => {
    process.argv.push('--config');
    process.argv.push('config.ts');
    vi.mocked(importConfig).mockResolvedValue({
        service: [],
        formatOptions: { colorsEnabled: true }
    });
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } }
    });
    const cucumberMock = {
        runCucumber: vi.fn().mockReturnValue({ success: true }),
        loadConfiguration: loadConfigurationMock,
        loadSources: vi.fn().mockReturnValue({ plan: [] }),
        loadSupport: vi.fn().mockReturnValue(supportMock)
    };
    await run(cucumberMock);
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.formatOptions).toEqual({ colorsEnabled: true });
});

test('exitCode=0 if passed --no-error-exit', async () => {
    process.argv.push('--no-error-exit');
    process.argv.push('--config')
    vi.mocked(importConfig).mockReturnValue(Promise.resolve({
        service: []
    }));
    const cucumberMock = {
        runCucumber: vi.fn().mockReturnValue({ success: false }),
        loadConfiguration: vi.fn(() => {
            return {runConfiguration: {support: {requireModules: []}}}
        }),
        loadSources: vi.fn(() => {
            return {plan: []}
        }),
        loadSupport: vi.fn(() => {
            return supportMock
        })
    };
    const chalkMock = {blue: vi.fn()};
    await run(cucumberMock);
    expect(process.exitCode).to.equal(0);
});

test('overrides replace merged options and can skip execution hooks', async () => {
    process.argv.push('--config', 'config.ts', '--paths', 'cli/*.feature');
    vi.mocked(importConfig).mockResolvedValue({
        paths: ['config/*.feature'],
        format: ['progress'],
    });
    const hook = Object.assign(vi.fn(), { isTestExecutionHook: true });
    const loadConfigurationMock = vi.fn().mockReturnValue({
        runConfiguration: { support: { requireModules: [] } }
    });
    const cucumberMock = {
        runCucumber: vi.fn().mockReturnValue({ success: true }),
        loadConfiguration: loadConfigurationMock,
        loadSources: vi.fn().mockReturnValue({ plan: [{}] }),
        loadSupport: vi.fn().mockReturnValue({
            beforeTestRunHookDefinitions: [{ code: hook }],
            afterTestRunHookDefinitions: [{ code: hook }],
        })
    };
    await run(cucumberMock, {
        paths: ['a.feature:3'],
        format: [['file:///ui/formatter.js']],
        dryRun: true,
        parallel: undefined,
        skipExecutionHooks: true
    });
    const [options] = loadConfigurationMock.mock.calls[0];
    expect(options.provided.paths).toEqual(['a.feature:3']);
    expect(options.provided.format).toEqual([['file:///ui/formatter.js']]);
    expect(options.provided.dryRun).toBe(true);
    expect(options.provided).not.toHaveProperty('skipExecutionHooks');
    expect(hook).not.toHaveBeenCalled();
});
