import ServiceHandler from './ServiceHandler';
import { resolve } from 'node:path';
import { importConfig } from './importConfig';
import { IRunResult } from '@cucumber/cucumber/api';
import { cliOptions } from './cliOptions';
import { existsSync } from 'node:fs';
import { version } from '../package.json';

/**
 * Merge json like params passed from CLI
 * @param list
 */
function mergeJSONParams(list: string[]): Object {
    return Object.assign({}, ...(list ?? []).map((option: string) => JSON.parse(option)));
}

/**
 * merge multiple instances of tags params
 * @param tags
 */
function mergeTags(tags: string[]) {
    return tags.map((tag: string) => `(${tag})`).join(' and ');
}

function isObject(obj: any) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * Deep object merge
 * @param target
 * @param sources
 */
function deepMerge(target: any, ...sources: any[]) {
    if (!sources.length) return target;

    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else if (Array.isArray(source[key])) {
                if (!Array.isArray(target[key])) target[key] = [];
                target[key] = target[key].concat(source[key]);
            } else if (source[key] !== undefined) {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}

/**
 * Timeout promise
 * @param promise - promise to wait
 * @param time - timeout
 * @param timeoutMsg - timeout message
 */
function timeout(promise: Promise<void>, time: number, timeoutMsg: string) {
    let timer: NodeJS.Timeout;
    return Promise.race([
        promise,
        new Promise((_, reject) => timer = setTimeout(() => reject(new Error(timeoutMsg)), time))
    ]).finally(() => clearTimeout(timer));
}

function formatConfigValue(value: any): string {
    if (typeof value === 'function') return '[Function]';
    if (Array.isArray(value)) return value.map(v => Array.isArray(v) ? v.join(':') : formatConfigValue(v)).join(', ');
    if (value !== null && typeof value === 'object') {
        if (Object.getPrototypeOf(value) === Object.prototype) {
            try { return JSON.stringify(value); } catch { return '[Object]'; }
        }
        return `[${value.constructor?.name ?? 'Object'}]`;
    }
    return String(value);
}

function printConfigTable(config: Record<string, any>, testCount: number, profile: string): void {
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
    const dim = '\x1b[2m', bold = '\x1b[1m', cyan = '\x1b[36m', reset = '\x1b[0m';
    const h = '─';
    const title = `@qavajs/core (v${version})`;
    const innerWidth = Math.max(kw + vw + 5, title.length + 2);
    const titlePad = innerWidth - 2 - title.length;
    const top    = `${dim}┌${h.repeat(innerWidth)}┐${reset}`;
    const mid    = `${dim}├${h.repeat(kw + 2)}┬${h.repeat(vw + 2)}┤${reset}`;
    const bottom = `${dim}└${h.repeat(kw + 2)}┴${h.repeat(vw + 2)}┘${reset}`;
    const col = `${dim}│${reset}`;
    console.log(top);
    console.log(`${col} ${bold}${cyan}${title}${reset}${' '.repeat(titlePad)} ${col}`);
    console.log(mid);
    for (const [k, v] of rows) console.log(`${col} ${bold}${k.padEnd(kw)}${reset} ${col} ${v.padEnd(vw)} ${col}`);
    console.log(bottom);
}

function getConfig(argvConfig?: string) {
    if (argvConfig) return argvConfig;
    if (existsSync('./config.ts')) return 'config.ts';
    if (existsSync('./config.js')) return 'config.js';
    throw new Error('No config provided');
}

export async function run({runCucumber, loadConfiguration, loadSources, loadSupport}: any): Promise<void> {
    const argv: any = cliOptions(process.argv);
    process.env.CONFIG = getConfig(argv.config);
    process.env.PROFILE = argv.profile ?? 'default';
    process.env.MEMORY_VALUES = argv.memoryValues ?? '{}';
    process.env.CLI_ARGV = process.argv.join(' ');
    const config = await importConfig(process.env.CONFIG as string, process.env.PROFILE as string);
    const serviceHandler = new ServiceHandler(config);
    const serviceTimeout = config.serviceTimeout ?? 60_000
    const timeoutMessage = `Service timeout '${serviceTimeout}' ms exceeded`;
    process.env.DEFAULT_TIMEOUT = String(config.defaultTimeout ?? 10_000);
    await timeout(serviceHandler.before(), serviceTimeout, timeoutMessage);
    const memoryLoadHook = resolve(__dirname, './load.js');
    if (argv.formatOptions) argv.formatOptions = mergeJSONParams(argv.formatOptions);
    if (argv.worldParameters) argv.worldParameters = mergeJSONParams(argv.worldParameters);
    if (argv.tags instanceof Array) argv.tags = argv.tags.length > 0 ? mergeTags(argv.tags) : undefined;
    const environment = {
        cwd: process.cwd(),
        stdout: process.stdout,
        stderr: process.stderr,
        env: process.env,
    }
    const options = {
        provided: deepMerge(config, argv),
        profiles: [process.env.PROFILE as string]
    }
    const { runConfiguration } = await loadConfiguration(options, environment);
    runConfiguration.support.requireModules = [memoryLoadHook, ...runConfiguration.support.requireModules];
    const {
        supportCode,
        beforeExecutionHooks,
        afterExecutionHooks
    } = await prepareSupportCode(loadSupport, runConfiguration);
    runConfiguration.support = supportCode;
    await Promise.all(beforeExecutionHooks.map((hook: any) => hook.code()));
    const { plan } = await loadSources(runConfiguration.sources);
    printConfigTable(options.provided, plan.length, process.env.PROFILE as string);
    const teardown = async () => {
        await Promise.all(afterExecutionHooks.map((hook: any) => hook.code()));
        await timeout(serviceHandler.after({ success: false, support: supportCode }), serviceTimeout, timeoutMessage);
    }
    if (plan.length === 0) {
        await teardown();
        process.exit(0);
    }
    const result: IRunResult = await runCucumber(runConfiguration, environment);
    await teardown();
    for (const formatPath in runConfiguration?.formats?.files ?? {}) {
        console.log(`${runConfiguration.formats.files[formatPath]} file://${resolve(process.cwd(), formatPath)}`);
    }
    process.exitCode = result.success || argv.errorExit === false ? 0 : 1;
}

export default async function (): Promise<void> {
    const cucumber = await import('@cucumber/cucumber/api');
    await run(cucumber);
}

async function prepareSupportCode(loadSupport: any, runConfiguration: any) {
    process.env.QAVAJS_COORDINATOR = '1';
    const supportCode = await loadSupport(runConfiguration);
    process.env.QAVAJS_COORDINATOR = '0';
    const beforeExecutionHooks = supportCode
        .beforeTestRunHookDefinitions
        .filter((hook: any) => hook.code.isTestExecutionHook)
    supportCode.beforeTestRunHookDefinitions = supportCode
        .beforeTestRunHookDefinitions
        .filter((hook: any) => !hook.code.isTestExecutionHook);
    const afterExecutionHooks = supportCode
        .afterTestRunHookDefinitions
        .filter((hook: any) => hook.code.isTestExecutionHook)
    supportCode.afterTestRunHookDefinitions = supportCode
        .afterTestRunHookDefinitions
        .filter((hook: any) => !hook.code.isTestExecutionHook);
    return {
        supportCode,
        beforeExecutionHooks,
        afterExecutionHooks,
    }
}