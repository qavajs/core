import { parseArgs, ParseArgsConfig } from 'node:util';
import { UsageError } from './UsageError';

export const OPTIONS = {
    config: { type: 'string' },
    profile: { type: 'string' },
    paths: { type: 'string', multiple: true },
    backtrace: { type: 'boolean', short: 'b' },
    'dry-run': { type: 'boolean', short: 'd' },
    'force-exit': { type: 'boolean' },
    exit: { type: 'boolean' },
    'fail-fast': { type: 'boolean' },
    format: { type: 'string', multiple: true, short: 'f' },
    'format-options': { type: 'string', multiple: true },
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
    'world-parameters': { type: 'string', multiple: true },
    'memory-values': { type: 'string' },
    shard: { type: 'string' },
    'no-error-exit': { type: 'boolean' },
    quiet: { type: 'boolean', short: 'q' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
} satisfies ParseArgsConfig['options'];

/** options handled by `qavajs ui`, not by the runner */
const UI_OPTIONS = ['port', 'host', 'open', 'no-open'];

const FEATURE_PATH = /\.feature(:\d+)*$/;

function toNonNegativeInt(flag: string, value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const number = Number(value);
    if (value.trim() === '' || !Number.isInteger(number) || number < 0) {
        throw new UsageError(`--${flag} must be a non-negative integer, got '${value}'`);
    }
    return number;
}

function levenshtein(a: string, b: string): number {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const current = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = current;
        }
    }
    return row[b.length];
}

/**
 * Find unknown flags that look like a typo of a known one.
 * Other unknown flags are custom params read by user code (see CLI_ARGV), so they are not reported.
 */
export function findTypos(argv: string[]): Array<{ flag: string, suggestion: string }> {
    const known = [...Object.keys(OPTIONS), ...UI_OPTIONS];
    const typos: Array<{ flag: string, suggestion: string }> = [];
    for (const arg of argv) {
        if (arg === '--') break;
        if (!arg.startsWith('--')) continue;
        const flag = arg.slice(2).split('=')[0];
        if (known.includes(flag)) continue;
        const suggestion = known
            .map(option => ({ option, distance: levenshtein(flag.toLowerCase(), option) }))
            .filter(({ distance }) => distance > 0 && distance <= Math.min(2, Math.floor(flag.length / 3)))
            .sort((a, b) => a.distance - b.distance)[0];
        if (suggestion) typos.push({ flag: `--${flag}`, suggestion: `--${suggestion.option}` });
    }
    return typos;
}

export function cliOptions(argv: string[]) {
    const { values, positionals } = parseArgs({
        args: argv.slice(2),
        options: OPTIONS,
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
    result.parallel = toNonNegativeInt('parallel', values.parallel as string | undefined);
    result.retry = toNonNegativeInt('retry', values.retry as string | undefined);
    if (values['no-error-exit']) result.errorExit = false;

    // `qavajs run features/login.feature:12` - positional feature paths are added to --paths
    const featurePaths = positionals.filter(positional => FEATURE_PATH.test(positional));
    if (featurePaths.length > 0) {
        result.paths = [...(result.paths ?? []), ...featurePaths];
    }

    return result;
}
