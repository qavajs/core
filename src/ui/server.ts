import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { UiSession } from './session';
import type { UiEvent } from './types';

const STATIC_ROOT = resolve(__dirname, '../../ui');
const STATIC_FILES: Record<string, string> = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/app.js': 'app.js',
    '/styles.css': 'styles.css',
};
const CONTENT_TYPES: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
};
const MAX_BODY = 1024 * 1024;

function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolveBody, reject) => {
        let size = 0;
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY) {
                reject(new Error('Request body is too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            try {
                resolveBody(raw ? JSON.parse(raw) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

/**
 * Protect local server against DNS rebinding and cross-site requests
 */
function isAllowedHost(req: IncomingMessage, allowedHosts: Set<string>) {
    const host = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    return allowedHosts.has(host);
}

export interface UiServerOptions {
    host: string;
    port: number;
}

export function createUiServer(session: UiSession, options: UiServerOptions): Server {
    const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', options.host]);
    const clients = new Set<ServerResponse>();

    session.on('event', (event: UiEvent) => {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        for (const client of clients) client.write(payload);
    });

    const heartbeat = setInterval(() => {
        for (const client of clients) client.write(': ping\n\n');
    }, 15_000);
    heartbeat.unref();

    const routes: Record<string, (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void> | void> = {
        'GET /api/events': (req, res) => {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-store',
                Connection: 'keep-alive',
            });
            res.write(`data: ${JSON.stringify({ type: 'snapshot', ...session.snapshot() })}\n\n`);
            clients.add(res);
            req.on('close', () => clients.delete(res));
        },
        'GET /api/state': (_req, res) => json(res, 200, session.snapshot()),
        'GET /api/source': async (_req, res, url) => {
            const uri = url.searchParams.get('uri') ?? '';
            // only files that are part of discovered test suite can be read
            if (!session.tree.some(feature => feature.uri === uri)) return json(res, 404, { error: 'unknown feature' });
            const content = await readFile(resolve(process.cwd(), uri), 'utf-8');
            json(res, 200, { uri, content });
        },
        'POST /api/run': async (req, res) => {
            const body = await readBody(req);
            const ids = Array.isArray(body.ids) ? body.ids.map(String) : undefined;
            if (session.isBusy()) return json(res, 409, { error: 'run is already in progress' });
            session.runTests(ids).catch(err => console.error(err));
            json(res, 202, { ok: true });
        },
        'POST /api/stop': (_req, res) => {
            session.stop();
            json(res, 200, { ok: true });
        },
        'POST /api/discover': (_req, res) => {
            if (session.isBusy()) return json(res, 409, { error: 'run is already in progress' });
            session.discover().catch(err => console.error(err));
            json(res, 202, { ok: true });
        },
    };

    return createServer(async (req, res) => {
        try {
            if (!isAllowedHost(req, allowedHosts)) {
                res.writeHead(403).end('Forbidden');
                return;
            }
            const url = new URL(req.url ?? '/', 'http://localhost');
            if (req.method === 'POST' && !String(req.headers['content-type']).startsWith('application/json')) {
                return json(res, 415, { error: 'application/json expected' });
            }
            const route = routes[`${req.method} ${url.pathname}`];
            if (route) return await route(req, res, url);

            const attachmentMatch = url.pathname.match(/^\/api\/attachments\/([\w-]+)$/);
            if (req.method === 'GET' && attachmentMatch) {
                const attachment = session.attachments.get(attachmentMatch[1]);
                if (!attachment) return json(res, 404, { error: 'attachment not found' });
                const headers: Record<string, string> = {
                    'Content-Type': attachment.mediaType,
                    'Content-Length': String(attachment.body.length),
                    'X-Content-Type-Options': 'nosniff',
                    // attachments are produced by test code: never let them run scripts in ui origin
                    'Content-Security-Policy': 'sandbox',
                };
                if (url.searchParams.has('download')) {
                    const fileName = (attachment.fileName ?? attachmentMatch[1]).replace(/["\\\r\n]/g, '_');
                    headers['Content-Disposition'] = `attachment; filename="${fileName}"`;
                }
                res.writeHead(200, headers);
                res.end(attachment.body);
                return;
            }

            const file = req.method === 'GET' ? STATIC_FILES[url.pathname] : undefined;
            if (file) {
                const content = await readFile(join(STATIC_ROOT, file));
                res.writeHead(200, {
                    'Content-Type': CONTENT_TYPES[file.split('.').pop()!],
                    'Cache-Control': 'no-cache',
                });
                res.end(content);
                return;
            }
            json(res, 404, { error: 'not found' });
        } catch (err: any) {
            if (!res.headersSent) json(res, err instanceof SyntaxError ? 400 : 500, { error: err?.message ?? String(err) });
            else res.end();
        }
    });
}
