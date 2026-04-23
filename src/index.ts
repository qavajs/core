import run from './run';
import { version } from '../package.json';

async function main() {
    console.log(`\x1b[1m\x1b[36m@qavajs/core (v${version})\x1b[0m`);
    return run();
}

main();

