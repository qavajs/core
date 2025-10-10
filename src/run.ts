import ServiceHandler from './ServiceHandler';
import { resolve } from 'node:path';
import { importConfig } from './importConfig';
import { IRunResult } from '@cucumber/cucumber/api';
import { cliOptions } from './cliOptions';
import { existsSync } from 'node:fs';
const chalkModule = import('chalk').then(m => m.default);

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
            } else {
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

function getConfig(argvConfig?: string) {
    if (argvConfig) return argvConfig;
    if (existsSync('./config.ts')) return 'config.ts';
    if (existsSync('./config.js')) return 'config.js';
    throw new Error('No config provided');
}

export async function run({runCucumber, loadConfiguration, loadSources, loadSupport}: any, chalk: any): Promise<void> {
    const argv: any = cliOptions(process.argv);
    process.env.CONFIG = getConfig(argv.config);
    process.env.PROFILE = argv.profile ?? 'default';
    process.env.MEMORY_VALUES = argv.memoryValues ?? '{}';
    process.env.CLI_ARGV = process.argv.join(' ');
    const config = await importConfig(process.env.CONFIG as string, process.env.PROFILE as string);
    const serviceHandler = new ServiceHandler(config);
    const serviceTimeout = config.serviceTimeout ?? 60_000
    const timeoutMessage = `Service timeout '${serviceTimeout}' ms exceeded`;
    process.env.DEFAULT_TIMEOUT = config.defaultTimeout ?? 10_000;
    await timeout(serviceHandler.before(), serviceTimeout, timeoutMessage);
    const memoryLoadHook = resolve(__dirname, './load.js');
    if (argv.formatOptions) argv.formatOptions = mergeJSONParams(argv.formatOptions);
    if (argv.worldParameters) argv.worldParameters = mergeJSONParams(argv.worldParameters);
    if (argv.tags instanceof Array) argv.tags = mergeTags(argv.tags);
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
    console.log(chalk.blue(`Test Cases: ${plan.length}`));
    const result: IRunResult = await runCucumber(runConfiguration, environment);
    await Promise.all(afterExecutionHooks.map((hook: any) => hook.code()));
    await timeout(serviceHandler.after(result), serviceTimeout, timeoutMessage);
    for (const formatPath in runConfiguration?.formats?.files ?? {}) {
        console.log(`${runConfiguration.formats.files[formatPath]} file://${resolve(process.cwd(), formatPath)}`);
    }
    process.exitCode = result.success || argv.errorExit === false ? 0 : 1;
}

export default async function (): Promise<void> {
    const chalk = await chalkModule;
    const cucumber = await import('@cucumber/cucumber/api');
    await run(cucumber, chalk);
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