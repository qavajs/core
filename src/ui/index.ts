import { spawn } from 'node:child_process';
import { AddressInfo } from 'node:net';
import { UiSession } from './session';
import { createUiServer } from './server';

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
        const value = () => inlineValue ?? args[++i];
        switch (flag) {
            case '--port': options.port = Number(value()); break;
            case '--host': options.host = value(); break;
            case '--open': options.open = true; break;
            case '--no-open': options.open = false; break;
            default: options.passthrough.push(args[i]);
        }
    }
    if (!Number.isInteger(options.port) || options.port < 0) throw new Error('--port must be a non-negative integer');
    return options;
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
    console.log(`\x1b[1m\x1b[36mqavajs ui\x1b[0m is running at ${url}`);
    console.log('\x1b[2mpress Ctrl+C to exit\x1b[0m');

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
