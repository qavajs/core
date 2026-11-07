import { test, expect, beforeAll, afterAll, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { request } from 'node:http';
import { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createUiServer } from '../../src/ui/server';

class FakeSession extends EventEmitter {
    busy = false;
    tree = [{ kind: 'feature', id: 'test/fixtures/feature.feature', uri: 'test/fixtures/feature.feature', name: 'F', line: 1, children: [] }];
    attachments = new Map([['a1', { body: Buffer.from('<script>alert(1)</script>'), mediaType: 'text/html', fileName: 'page.html' }]]);
    runTests = vi.fn(async () => true);
    discover = vi.fn(async () => {});
    stop = vi.fn();
    isBusy() { return this.busy; }
    snapshot() { return { tree: this.tree, tests: [], run: { state: 'idle', testIds: [] }, output: [], error: null }; }
}

let server: Server;
let session: FakeSession;
let base: string;

beforeAll(async () => {
    session = new FakeSession();
    server = createUiServer(session as any, { host: '127.0.0.1', port: 0 });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
    server.closeAllConnections();
    server.close();
});

const post = (path: string, body: unknown) => fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});

test('serves static ui', async () => {
    const response = await fetch(base + '/');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('app.js');
    expect((await fetch(base + '/app.js')).headers.get('content-type')).toContain('javascript');
    expect((await fetch(base + '/../package.json')).status).toBe(404);
});

test('run endpoint', async () => {
    expect((await post('/api/run', { ids: ['a:1'] })).status).toBe(202);
    expect(session.runTests).toHaveBeenCalledWith(['a:1']);
    expect((await post('/api/run', {})).status).toBe(202);
    expect(session.runTests).toHaveBeenLastCalledWith(undefined);
    session.busy = true;
    expect((await post('/api/run', {})).status).toBe(409);
    expect((await post('/api/discover', {})).status).toBe(409);
    session.busy = false;
    expect((await post('/api/discover', {})).status).toBe(202);
});

test('stop endpoint', async () => {
    await post('/api/stop', {});
    expect(session.stop).toHaveBeenCalled();
});

test('rejects non-json posts, foreign hosts and invalid json', async () => {
    expect((await fetch(base + '/api/run', { method: 'POST', body: 'ids=1' })).status).toBe(415);
    // fetch does not allow overriding Host header
    const status = await new Promise(resolve => request(base + '/api/state', { headers: { Host: 'evil.example' } }, res => {
        res.resume();
        resolve(res.statusCode);
    }).end());
    expect(status).toBe(403);
    const invalid = await fetch(base + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    expect(invalid.status).toBe(400);
});

test('source endpoint only serves discovered features', async () => {
    const ok = await fetch(base + '/api/source?uri=test/fixtures/feature.feature');
    expect(ok.status).toBe(200);
    expect((await ok.json()).content).toContain('Feature');
    expect((await fetch(base + '/api/source?uri=package.json')).status).toBe(404);
});

test('attachments are sandboxed', async () => {
    const response = await fetch(base + '/api/attachments/a1?download');
    expect(response.headers.get('content-security-policy')).toBe('sandbox');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="page.html"');
    expect((await fetch(base + '/api/attachments/zzz')).status).toBe(404);
});

test('event stream sends snapshot and broadcasts session events', async () => {
    const controller = new AbortController();
    const response = await fetch(base + '/api/events', { signal: controller.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const first = decoder.decode((await reader.read()).value);
    expect(first).toContain('"type":"snapshot"');
    session.emit('event', { type: 'error', message: null });
    const second = decoder.decode((await reader.read()).value);
    expect(second).toBe('data: {"type":"error","message":null}\n\n');
    controller.abort();
});
