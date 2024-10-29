import run from './run';
import { cliOptions } from './cliOptions';
const chalk = import('chalk').then(m => m.default);

const argv: any = cliOptions(process.argv.slice(2));

async function main() {
    const { bold, cyan } = await chalk;
    console.log(bold(cyan(`@qavajs/core (v${require('../package.json').version})`)));
    return run();
}

main();

