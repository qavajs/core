import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type {
    IRunEnvironment,
    IRunOptions,
    IRunResult,
    ISupportCodeLibrary,
    loadConfiguration,
    loadSources,
    loadSupport,
    runCucumber,
} from '@cucumber/cucumber/api';
import { importConfig } from './importConfig';
import { cliOptions, CliOptions } from './cliOptions';
import { version } from '../package.json';
import { UsageError } from './UsageError';
import { painter } from './colors';
import { isPlainObject, mergeConfig } from './mergeConfig';

/**
 * Subset of `@cucumber/cucumber/api` used by qavajs
 */
export interface CucumberApi {
    runCucumber: typeof runCucumber;
    loadConfiguration: typeof loadConfiguration;
    loadSources: typeof loadSources;
    loadSupport: typeof loadSupport;
}

/**
 * Hook as stored in support code library. Marked by BeforeExecution/AfterExecution
 */
interface TestRunHook {
    code: { (): unknown, isTestExecutionHook?: boolean };
}

/**
 * Fields of the support code library that are not part of cucumber public types
 */
interface SupportCodeLibraryWithHooks extends ISupportCodeLibrary {
    beforeTestRunHookDefinitions: TestRunHook[];
    afterTestRunHookDefinitions: TestRunHook[];
}

/**
 * Parse json param passed from CLI
 * @param flag - flag name used in error message
 * @param value - raw json
 */
function parseJSONParam(flag: string, value: string): unknown {
    try {
        return JSON.parse(value);
    } catch (err) {
        throw new UsageError(`--${flag} must be valid JSON: ${(err as Error).message}\n  received: ${value}`);
    }
}

/**
 * Merge json like params passed from CLI
 * @param flag - flag name used in error message
 * @param list - raw json values
 */
function mergeJSONParams(flag: string, list: string | string[]): Record<string, unknown> {
    const values = Array.isArray(list) ? list : [list];
    return Object.assign({}, ...values.map(option => parseJSONParam(flag, option)));
}

/**
 * merge multiple instances of tags params
 * @param tags
 */
function mergeTags(tags: string[]) {
    return tags.map((tag: string) => `(${tag})`).join(' and ');
}

function formatConfigValue(value: unknown): string {
    if (typeof value === 'function') return '[Function]';
    if (Array.isArray(value)) return value.map(v => Array.isArray(v) ? v.join(':') : formatConfigValue(v)).join(', ');
    if (value !== null && typeof value === 'object') {
        if (isPlainObject(value)) {
            try { return JSON.stringify(value); } catch { return '[Object]'; }
        }
        return `[${value.constructor?.name ?? 'Object'}]`;
    }
    return String(value);
}

function printConfigTable(config: Record<string, unknown>, testCount: number, profile: string): void {
    const rows: [string, string][] = [];
    const DISPLAY_KEYS = new Set(['profile', 'paths', 'require', 'import', 'format', 'defaultTimeout', 'parallel', 'config', 'tags', 'testCases']);
    for (const [key, value] of Object.entries(config)) {
        if (!DISPLAY_KEYS.has(key)) continue;
        if (value === undefined || value === null || typeof value === 'function') continue;
        const raw = formatConfigValue(value);
        rows.push([key, raw.length > 80 ? raw.slice(0, 77) + '...' : raw]);
    }
    rows.push(['profile', profile]);
    rows.push(['testCases', String(testCount)]);
    const kw = Math.max(...rows.map(([k]) => k.length));
    const vw = Math.max(...rows.map(([, v]) => v.length));
    const paint = painter(process.stdout);
    const h = '─';
    const title = `@qavajs/core (v${version})`;
    const innerWidth = Math.max(kw + vw + 5, title.length + 2);
    const titlePad = innerWidth - 2 - title.length;
    const col = paint('│', 'dim');
    console.log(paint(`┌${h.repeat(innerWidth)}┐`, 'dim'));
    console.log(`${col} ${paint(title, 'bold', 'cyan')}${' '.repeat(titlePad)} ${col}`);
    console.log(paint(`├${h.repeat(kw + 2)}┬${h.repeat(vw + 2)}┤`, 'dim'));
    for (const [k, v] of rows) console.log(`${col} ${paint(k.padEnd(kw), 'bold')} ${col} ${v.padEnd(vw)} ${col}`);
    console.log(paint(`└${h.repeat(kw + 2)}┴${h.repeat(vw + 2)}┘`, 'dim'));
}

export const DEFAULT_CONFIGS = ['config.ts', 'config.js', 'config.mjs', 'config.cjs'];

function getConfig(argvConfig?: string) {
    if (argvConfig) return argvConfig;
    const defaultConfig = DEFAULT_CONFIGS.find(config => existsSync(`./${config}`));
    if (defaultConfig) return defaultConfig;
    throw new UsageError(
        `No config provided: none of ${DEFAULT_CONFIGS.join(', ')} found in ${process.cwd()}. ` +
        `Pass a config file with --config <path>`
    );
}

/**
 * Options that take precedence over both config file and CLI values (used by ui mode workers)
 */
export interface RunOverrides {
    /** replaces resolved feature paths */
    paths?: string[];
    /** replaces resolved formatters */
    format?: Array<string | string[]>;
    dryRun?: boolean;
    parallel?: number;
    /** do not call BeforeExecution/AfterExecution hooks */
    skipExecutionHooks?: boolean;
}

/**
 * Convert raw CLI options into configuration values understood by cucumber
 */
function normalizeCliOptions(argv: CliOptions): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...argv };
    if (argv.formatOptions) normalized.formatOptions = mergeJSONParams('format-options', argv.formatOptions);
    if (argv.worldParameters) normalized.worldParameters = mergeJSONParams('world-parameters', argv.worldParameters);
    if (Array.isArray(argv.tags)) normalized.tags = argv.tags.length > 0 ? mergeTags(argv.tags) : undefined;
    return normalized;
}

export async function run(cucumber: CucumberApi, overrides: RunOverrides = {}): Promise<void> {
    const { runCucumber, loadConfiguration, loadSources, loadSupport } = cucumber;
    const { skipExecutionHooks, ...providedOverrides } = overrides;
    const argv = cliOptions(process.argv);
    const configPath = getConfig(argv.config);
    const profile = argv.profile ?? 'default';
    if (argv.memoryValues) parseJSONParam('memory-values', argv.memoryValues);
    process.env.CONFIG = configPath;
    process.env.PROFILE = profile;
    process.env.MEMORY_VALUES = argv.memoryValues ?? '{}';
    process.env.CLI_ARGV = process.argv.join(' ');
    const config = await importConfig(configPath, profile);
    process.env.DEFAULT_TIMEOUT = String(config.defaultTimeout ?? 10_000);
    const memoryLoadHook = resolve(__dirname, './load.js');
    const environment: IRunEnvironment = {
        cwd: process.cwd(),
        stdout: process.stdout,
        stderr: process.stderr,
        env: process.env,
    };
    const provided = mergeConfig(config, normalizeCliOptions(argv));
    for (const [key, value] of Object.entries(providedOverrides)) {
        if (value !== undefined) provided[key] = value;
    }
    const { runConfiguration } = await loadConfiguration({ provided, profiles: [profile] }, environment);
    const support = runConfiguration.support;
    support.requireModules = [memoryLoadHook, ...(support.requireModules ?? [])];
    const {
        supportCode,
        beforeExecutionHooks,
        afterExecutionHooks
    } = await prepareSupportCode(loadSupport, { ...runConfiguration, support }, environment);
    const runOptions: IRunOptions = { ...runConfiguration, support: supportCode };
    let result: IRunResult;
    try {
        if (!skipExecutionHooks) await runBeforeExecutionHooks(beforeExecutionHooks);
        const { plan } = await loadSources(runConfiguration.sources, environment);
        if (!argv.quiet) printConfigTable(provided, plan.length, profile);
        result = plan.length > 0 ? await runCucumber(runOptions, environment) : { success: true, support: supportCode };
    } catch (err) {
        // teardown must happen even if setup or the run itself crashed; the original error wins
        if (!skipExecutionHooks) {
            const teardownErrors = await runAfterExecutionHooks(afterExecutionHooks);
            for (const teardownError of teardownErrors) console.error('[qavajs] AfterExecution hook failed:', teardownError);
        }
        throw err;
    }
    if (!skipExecutionHooks) {
        const teardownErrors = await runAfterExecutionHooks(afterExecutionHooks);
        if (teardownErrors.length === 1) throw teardownErrors[0];
        if (teardownErrors.length > 1) throw new AggregateError(teardownErrors, `${teardownErrors.length} AfterExecution hooks failed`);
    }
    const reportFiles = runConfiguration.formats?.files ?? {};
    for (const [formatPath, formatter] of Object.entries(reportFiles)) {
        console.log(`${formatter} file://${resolve(process.cwd(), formatPath)}`);
    }
    process.exitCode = result.success || argv.errorExit === false ? 0 : 1;
}

export default async function (): Promise<void> {
    const cucumber = await import('@cucumber/cucumber/api');
    await run(cucumber);
}

/**
 * Run BeforeExecution hooks one by one in registration order, so a hook can rely on the previous one.
 * Stops on the first failure.
 */
async function runBeforeExecutionHooks(hooks: TestRunHook[]): Promise<void> {
    for (const hook of hooks) await hook.code();
}

/**
 * Run AfterExecution hooks one by one in reverse registration order (like cucumber AfterAll),
 * so resources are torn down in the opposite order they were set up.
 * Every hook is called even if a previous one failed; errors are returned.
 */
async function runAfterExecutionHooks(hooks: TestRunHook[]): Promise<unknown[]> {
    const errors: unknown[] = [];
    for (const hook of [...hooks].reverse()) {
        try {
            await hook.code();
        } catch (err) {
            errors.push(err);
        }
    }
    return errors;
}

async function prepareSupportCode(
    load: CucumberApi['loadSupport'],
    options: Parameters<CucumberApi['loadSupport']>[0],
    environment: IRunEnvironment
) {
    process.env.QAVAJS_COORDINATOR = '1';
    let supportCode: SupportCodeLibraryWithHooks;
    try {
        supportCode = await load(options, environment) as SupportCodeLibraryWithHooks;
    } finally {
        process.env.QAVAJS_COORDINATOR = '0';
    }
    const isExecutionHook = (hook: TestRunHook) => Boolean(hook.code.isTestExecutionHook);
    const beforeExecutionHooks = supportCode.beforeTestRunHookDefinitions.filter(isExecutionHook);
    supportCode.beforeTestRunHookDefinitions = supportCode.beforeTestRunHookDefinitions.filter(hook => !isExecutionHook(hook));
    const afterExecutionHooks = supportCode.afterTestRunHookDefinitions.filter(isExecutionHook);
    supportCode.afterTestRunHookDefinitions = supportCode.afterTestRunHookDefinitions.filter(hook => !isExecutionHook(hook));
    return {
        supportCode,
        beforeExecutionHooks,
        afterExecutionHooks,
    };
}
