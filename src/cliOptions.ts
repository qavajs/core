import { parseArgs } from 'node:util';

export function cliOptions(argv: string[]) {
    const { values } = parseArgs({
        args: argv.slice(2),
        options: {
            config: { type: 'string' },
            profile: { type: 'string' },
            paths: { type: 'string', multiple: true },
            backtrace: { type: 'boolean', short: 'b' },
            'dry-run': { type: 'boolean', short: 'd' },
            'force-exit': { type: 'boolean' },
            exit: { type: 'boolean' },
            'fail-fast': { type: 'boolean' },
            format: { type: 'string', multiple: true, short: 'f' },
            'format-options': { type: 'string' },
            import: { type: 'string', multiple: true, short: 'i' },
            name: { type: 'string', multiple: true },
            order: { type: 'string' },
            parallel: { type: 'string' },
            require: { type: 'string', multiple: true, short: 'r' },
            'require-module': { type: 'string', multiple: true },
            retry: { type: 'string' },
            'retry-tag-filter': { type: 'string', multiple: true },
            strict: { type: 'boolean' },
            tags: { type: 'string', multiple: true, short: 't' },
            'world-parameters': { type: 'string' },
            'memory-values': { type: 'string' },
            shard: { type: 'string' },
            'no-error-exit': { type: 'boolean' },
        },
        strict: false,
        allowPositionals: true,
    });

    const result: any = {
        ...values,
        dryRun: values['dry-run'],
        forceExit: values['force-exit'] || values['exit'],
        failFast: values['fail-fast'],
        formatOptions: values['format-options'],
        requireModule: values['require-module'],
        retryTagFilter: values['retry-tag-filter'],
        worldParameters: values['world-parameters'],
        memoryValues: values['memory-values'],
    };
    if (result.parallel !== undefined) result.parallel = Number(result.parallel);
    if (result.retry !== undefined) result.retry = Number(result.retry);
    if (values['no-error-exit']) result.errorExit = false;

    return result;
}
