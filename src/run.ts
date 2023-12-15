import yargs from 'yargs';
import ServiceHandler from './ServiceHandler';
import path from 'path';
import importConfig from './importConfig';
import { IPlannedPickle, IRunResult } from '@cucumber/cucumber/api';
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

export default async function(): Promise<void> {
    const chalk = await chalkModule;
    const { runCucumber, loadConfiguration, loadSources } = await import('@cucumber/cucumber/api');
    const argv: any = yargs(process.argv).argv;
    process.env.CONFIG = argv.config ?? 'config.js';
    process.env.PROFILE = argv.profile ?? 'default';
    process.env.MEMORY_VALUES = argv.memoryValues ?? '{}';
    process.env.CLI_ARGV = process.argv.join(' ');
    const serviceHandler = new ServiceHandler(process.env.CONFIG as string, process.env.PROFILE as string);
    const config = await importConfig(process.env.CONFIG as string, process.env.PROFILE as string);
    const serviceTimeout = config.serviceTimeout || 600_000
    const timeoutMessage = `Service timeout '${serviceTimeout}' ms exceeded`;
    process.env.DEFAULT_TIMEOUT = config.defaultTimeout ?? 10_000;
    await Promise.race([
        // @ts-ignore
        new Promise((_, reject) => setTimeout(reject(new Error(timeoutMessage)), serviceTimeout)),
        serviceHandler.before()
    ]);
    const memoryLoadHook = path.resolve(__dirname, './loadHook.js');
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
        provided: {...config, ...argv},
        profiles: [process.env.PROFILE as string]
    }
    const { runConfiguration } = await loadConfiguration(options, environment);
    runConfiguration.support.requireModules = [memoryLoadHook, ...runConfiguration.support.requireModules];
    if (argv.shard) {
        console.log(chalk.blue(`Shard: ${argv.shard}`));
        const { plan } = await loadSources(runConfiguration.sources);
        const [ shard, totalShards ] = argv.shard.split('/').map((val: string) => parseInt(val));
        process.env.SHARD = shard;
        process.env.TOTAL_SHARDS = totalShards;
        const chunkLength = plan.length / totalShards;
        const startIndex = Math.floor(shard * chunkLength - chunkLength);
        const endIndex = totalShards/shard === 1 ? plan.length : chunkLength * shard;
        const chunk = plan.slice(startIndex, endIndex);
        runConfiguration.sources.names = chunk.map((scenario: IPlannedPickle) => scenario.name);
    }
    const { plan } = await loadSources(runConfiguration.sources);
    console.log(chalk.blue(`Test Cases: ${plan.length}`));
    const result: IRunResult = await runCucumber(runConfiguration, environment);
    await Promise.race([
        // @ts-ignore
        new Promise((_, reject) => setTimeout(reject(new Error(timeoutMessage)), serviceTimeout)),
        serviceHandler.after(result)
    ]);
}
