import run from './run';

async function main() {
    console.log(`\x1b[1m\x1b[36m@qavajs/core (v${require('../package.json').version})\x1b[0m`);
    return run();
}

main();

