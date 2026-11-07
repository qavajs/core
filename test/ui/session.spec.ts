import { test, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { UiSession } from '../../src/ui/session';
import { gherkinEnvelopes, executionEnvelopes } from './envelopes';

class FakeChild extends EventEmitter {
    stdout = new PassThrough();
    stderr = new PassThrough();
    connected = true;
    exitCode: number | null = null;
    signalCode: string | null = null;
    pid = 1234;
    received: any[] = [];
    constructor(private script: (child: FakeChild, overrides: any) => void) {
        super();
    }
    send(message: any) {
        this.received.push(message);
        setImmediate(() => this.script(this, message));
        return true;
    }
    emitMessages(messages: any[]) {
        for (const envelope of messages) this.emit('message', { type: 'envelope', envelope });
    }
    finish(code = 0, done: any = { type: 'done', success: code === 0 }) {
        if (done) this.emit('message', done);
        this.connected = false;
        this.exitCode = code;
        this.emit('exit', code);
        this.emit('disconnect');
    }
    kill(signal: string) {
        this.signalCode = signal;
        this.connected = false;
        this.emit('exit', null);
        this.emit('disconnect');
        return true;
    }
}

let children: FakeChild[];

function createSession(runScript?: (child: FakeChild, overrides: any) => void) {
    return new UiSession({
        cwd: process.cwd(),
        args: ['--config', 'config.js'],
        forkWorker: () => {
            const child = new FakeChild((child, overrides) => {
                if (overrides.dryRun) {
                    child.emitMessages(gherkinEnvelopes());
                    return child.finish();
                }
                (runScript ?? ((c: FakeChild) => {
                    c.emitMessages([...gherkinEnvelopes(), ...executionEnvelopes()]);
                    c.stdout.write('log line');
                    c.finish(1);
                }))(child, overrides);
            });
            children.push(child);
            return child as any;
        }
    });
}

beforeEach(() => {
    children = [];
});

test('discover builds tree and broadcasts events', async () => {
    const session = createSession();
    const events: any[] = [];
    session.on('event', e => events.push(e));
    await session.discover();
    expect(children[0].received[0]).toMatchObject({ dryRun: true, parallel: 0, skipExecutionHooks: true });
    expect(children[0].received[0].format[0][0]).toMatch(/^file:.*formatter\.js$/);
    expect(session.tests.size).toBe(3);
    expect(session.tree[0].name).toBe('Demo');
    expect(events.map(e => e.type)).toEqual(['run', 'error', 'tree', 'run']);
    expect(session.isBusy()).toBe(false);
});

test('discover failure sets error and keeps previous tree', async () => {
    let fail = false;
    const session = new UiSession({
        cwd: process.cwd(),
        args: [],
        forkWorker: () => new FakeChild((child) => {
            if (fail) return child.finish(1, { type: 'fatal', message: 'SyntaxError: bad step' });
            child.emitMessages(gherkinEnvelopes());
            child.finish();
        }) as any
    });
    await session.discover();
    fail = true;
    await session.discover();
    expect(session.error).toBe('SyntaxError: bad step');
    expect(session.tests.size).toBe(3);
});

test('runTests streams results and collects output and attachments', async () => {
    const session = createSession();
    await session.discover();
    const done = session.runTests(['features/demo.feature:6']);
    expect(session.isBusy()).toBe(true);
    expect(session.tests.get('features/demo.feature:6')!.status).toBe('queued');
    await done;
    const runChild = children[1];
    expect(runChild.received[0].paths).toEqual(['features/demo.feature:6']);
    const test = session.tests.get('features/demo.feature:6')!;
    expect(test.status).toBe('failed');
    expect(session.attachments.size).toBe(2);
    expect(session.output.map(o => o.text).join('')).toContain('log line');
    expect(session.run).toMatchObject({ state: 'idle', testIds: ['features/demo.feature:6'] });
    expect(session.run.finishedAt).toBeGreaterThanOrEqual(session.run.startedAt!);
    // rerun releases previous attachments
    await session.runTests(['features/demo.feature:6']);
    expect(session.attachments.size).toBe(2);
});

test('runTests without ids runs config paths', async () => {
    const session = createSession();
    await session.runTests();
    expect(children).toHaveLength(2);
    expect(children[1].received[0].paths).toBeUndefined();
    expect(session.run.testIds).toHaveLength(3);
});

test('runTests rejects concurrent and unknown runs', async () => {
    const session = createSession();
    await session.discover();
    expect(await session.runTests(['unknown:1'])).toBe(false);
    const first = session.runTests();
    expect(await session.runTests()).toBe(false);
    await first;
});

test('stop marks running test as interrupted and queued tests as idle', async () => {
    const session = createSession((child) => {
        child.emitMessages([...gherkinEnvelopes(), executionEnvelopes()[0], executionEnvelopes()[1]]);
    });
    await session.discover();
    const run = session.runTests();
    await new Promise(r => setTimeout(r, 20));
    expect(session.tests.get('features/demo.feature:6')!.status).toBe('running');
    session.stop();
    await run;
    expect(session.tests.get('features/demo.feature:6')!.status).toBe('interrupted');
    expect(session.tests.get('features/demo.feature:15')!.status).toBe('idle');
    expect(session.run.error).toBeUndefined();
});

test('worker crash is reported as run error', async () => {
    const session = createSession((child) => child.finish(1, null));
    await session.discover();
    await session.runTests();
    expect(session.run.error).toBe('Worker exited with code 1');
    expect(session.output.at(-1)!.stream).toBe('stderr');
});

test('rediscovery keeps results of unchanged tests', async () => {
    const session = createSession();
    await session.runTests(['features/demo.feature:6']);
    await session.discover();
    expect(session.tests.get('features/demo.feature:6')!.status).toBe('failed');
    expect(session.tests.get('features/demo.feature:6')!.steps[1].attachments).toHaveLength(2);
});

test('snapshot and output limits', async () => {
    const session = createSession((child) => {
        child.stdout.write('x'.repeat(1024 * 1024));
        child.stdout.write('y'.repeat(1024 * 1024));
        child.stdout.write('z'.repeat(1024 * 1024));
        setImmediate(() => child.finish());
    });
    await session.runTests();
    expect(session.output.map(o => o.text[0])).toEqual(['y', 'z']);
    expect(session.snapshot()).toMatchObject({ error: null, run: { state: 'idle' } });
});
