import { version } from '../package.json';

export { version };

export const HELP = `@qavajs/core v${version}

Usage:
  qavajs [run] [options] [feature paths...]
  qavajs ui [ui options] [options]

Commands:
  run                         Run tests (default)
  ui                          Open the interactive test runner in the browser

Options:
  --config <path>             Config file (default: config.ts, config.js, config.mjs or config.cjs)
  --profile <name>            Config profile to run (default: default)
  --paths <glob>              Feature file paths, also accepted as positional args (repeatable)
  -t, --tags <expression>     Tag expression filter (repeatable, ANDed)
  --name <regex>              Scenario name filter (repeatable)
  -f, --format <name[:file]>  Formatter and optional output file (repeatable)
  --format-options <json>     JSON options for formatters (repeatable, merged)
  -i, --import <glob>         Support code paths, ESM (repeatable)
  -r, --require <glob>        Support code paths, CJS (repeatable)
  --require-module <module>   Transpilation module to require (repeatable)
  --parallel <n>              Number of worker processes
  --retry <n>                 Retry failing tests n times
  --retry-tag-filter <expr>   Tag expression for retryable scenarios (repeatable)
  --order <defined|random>    Run order
  --shard <x/y>               Run shard x of y
  --world-parameters <json>   JSON parameters passed to World (repeatable, merged)
  --memory-values <json>      JSON values that override memory
  -d, --dry-run               Prepare run without executing steps
  -b, --backtrace             Show full error backtraces
  --fail-fast                 Stop on first failure
  --strict                    Fail on pending steps
  --force-exit                Call process.exit() after the run
  --no-error-exit             Exit with code 0 even if tests fail
  -q, --quiet                 Do not print the config table
  -h, --help                  Show this help
  -v, --version               Show version

UI options:
  --port <n>                  Port of the UI server (default: random)
  --host <host>               Host to bind the UI server to (default: localhost)
  --no-open                   Do not open the browser automatically

Docs: https://github.com/qavajs/core#readme`;
