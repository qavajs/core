import { spawn } from 'node:child_process';
import { AddressInfo } from 'node:net';
import { UiSession } from './session';
import { createUiServer } from './server';
import { UsageError } from '../UsageError';
import { painter } from '../colors';

export interface UiOptions {
    host: string;
    port: number;
    open: boolean;
    /** arguments forwarded to every test run */
    passthrough: string[];
}

/**
 * Split `qavajs ui [options]` argv into ui server options and run options
 */
export function parseUiArgs(argv: string[]): UiOptions {
    const options: UiOptions = { host: 'localhost', port: 0, open: true, passthrough: [] };
    const args = argv.slice(2);
    if (args[0] === 'ui') args.shift();
    for (let i = 0; i < args.length; i++) {
        const [flag, inlineValue] = args[i].split(/=(.*)/s);
        const value = () => {
            if (inlineValue !== undefined) return inlineValue;
            const next = args[i + 1];
            if (next === undefined || next.startsWith('-')) throw new UsageError(`${flag} requires a value`);
            i++;
            return next;
        };
        switch (flag) {
            case '--port': options.port = parsePort(value()); break;
            case '--host': options.host = value(); break;
            case '--open': options.open = true; break;
            case '--no-open': options.open = false; break;
            default: options.passthrough.push(args[i]);
        }
    }
    if (options.host.trim() === '') throw new UsageError('--host must not be empty');
    return options;
}

function parsePort(value: string): number {
    const port = Number(value);
    if (value.trim() === '' || !Number.isInteger(port) || port < 0 || port > 65535) {
        throw new UsageError(`--port must be an integer between 0 and 65535, got '${value}'`);
    }
    return port;
}

function openBrowser(url: string) {
    const [command, args] = process.platform === 'darwin'
        ? ['open', [url]]
        : process.platform === 'win32'
            ? ['cmd', ['/c', 'start', '""', url]]
            : ['xdg-open', [url]];
    try {
        spawn(command as string, args as string[], { stdio: 'ignore', detached: true })
            .on('error', () => {})
            .unref();
    } catch {
        // ignore: url is printed anyway
    }
}

export async function startUi(argv: string[] = process.argv): Promise<void> {
    const options = parseUiArgs(argv);
    const cwd = process.cwd();
    const session = new UiSession({ cwd, args: options.passthrough });
    const server = createUiServer(session, options);
    await new Promise<void>((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(options.port, options.host, resolveListen);
    });
    const { port } = server.address() as AddressInfo;
    const url = `http://${options.host.includes(':') ? `[${options.host}]` : options.host}:${port}`;
    const paint = painter(process.stdout);
    console.log(`${paint('qavajs ui', 'bold', 'cyan')} is running at ${url}`);
    console.log(paint('press Ctrl+C to exit', 'dim'));

    const shutdown = () => {
        session.dispose();
        server.closeAllConnections();
        server.close();
        setTimeout(() => process.exit(0), 200).unref();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    session.discover().catch(err => console.error(err));
    if (options.open) openBrowser(url);
}
