import run from './run';
import { HELP, version } from './help';
import { findTypos } from './cliOptions';
import { UsageError } from './UsageError';

const COMMANDS = ['run', 'ui'];

function fail(err: Error) {
    if (err instanceof UsageError) {
        console.error(`\x1b[31merror:\x1b[0m ${err.message}`);
    } else {
        console.error(err);
    }
    process.exitCode = 1;
}

function main() {
    const args = process.argv.slice(2);
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
    for (const { flag, suggestion } of findTypos(options)) {
        console.warn(`\x1b[33mwarning:\x1b[0m unknown option '${flag}', did you mean '${suggestion}'?`);
    }
    if (command === 'ui') {
        const { startUi } = require('./ui') as typeof import('./ui');
        return startUi().catch(fail);
    }
    return run().catch(fail);
}

try {
    main();
} catch (err) {
    fail(err as Error);
}
