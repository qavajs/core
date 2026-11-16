import run from './run';
import { HELP, version } from './help';
import { findTypos } from './cliOptions';
import { UsageError } from './UsageError';
import { painter } from './colors';

export const COMMANDS = ['run', 'ui'];

export function fail(err: Error) {
    if (err instanceof UsageError) {
        console.error(`${painter(process.stderr)('error:', 'red')} ${err.message}`);
    } else {
        console.error(err);
    }
    process.exitCode = 1;
}

/** ui mode is loaded lazily: it is not needed for regular runs */
const loadUi = (): typeof import('./ui') => require('./ui');

/**
 * CLI entry: dispatches `qavajs [run|ui] [options]`
 * @param argv - process argv
 * @param deps - overridable dependencies (tests)
 */
export function main(argv: string[] = process.argv, deps = { loadUi }): Promise<void> | void {
    const args = argv.slice(2);
    const options = args.slice(0, args.includes('--') ? args.indexOf('--') : undefined);
    if (options.includes('--help') || options.includes('-h') || args[0] === 'help') {
        console.log(HELP);
        return;
    }
    if (options.includes('--version') || options.includes('-v')) {
        console.log(version);
        return;
    }
    const command = args[0];
    // a bare word (not a flag or a path) in the command position is a mistyped command
    if (command && !COMMANDS.includes(command) && /^[a-z][\w-]*$/i.test(command)) {
        throw new UsageError(`unknown command '${command}'. Available commands: ${COMMANDS.join(', ')}. Run 'qavajs --help' for usage`);
    }
    const paint = painter(process.stderr);
    for (const { flag, suggestion } of findTypos(options)) {
        console.warn(`${paint('warning:', 'yellow')} unknown option '${flag}', did you mean '${suggestion}'?`);
    }
    if (command === 'ui') {
        return deps.loadUi().startUi(argv).catch(fail);
    }
    return run().catch(fail);
}
