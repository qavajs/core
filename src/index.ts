import run from './run';
const chalk = import('chalk').then(m => m.default);

async function main() {
    const { bold, cyan } = await chalk;
    console.log(bold(cyan(`@qavajs/core (v${require('../package.json').version})`)));
    return run();
}

main();

