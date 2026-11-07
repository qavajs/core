import { EventEmitter } from 'node:events';
import { ChildProcess, fork, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RunOverrides } from '../run';
import { EnvelopeProcessor, StoredAttachment, toCucumberPaths } from './processor';
import type { RunInfo, TestView, TreeNode, UiEvent } from './types';

export interface SessionOptions {
    cwd: string;
    /** cli args passed through to workers (config, profile, tags, etc.) */
    args: string[];
    /** override child process creation (tests) */
    forkWorker?: (args: string[]) => ChildProcess;
}

const MAX_OUTPUT = 2 * 1024 * 1024;
const KILL_TIMEOUT = 3000;
const EXIT_GRACE_TIMEOUT = 2000;

export class UiSession extends EventEmitter {
    tree: TreeNode[] = [];
    tests = new Map<string, TestView>();
    attachments = new Map<string, StoredAttachment>();
    run: RunInfo = { state: 'idle', testIds: [] };
    output: Array<{ text: string, stream: 'stdout' | 'stderr' }> = [];
    error: string | null = null;
    private outputSize = 0;
    private child: ChildProcess | null = null;
    private stopRequested = false;
    private formatterPath = pathToFileURL(resolve(__dirname, 'formatter.js')).href;

    constructor(private options: SessionOptions) {
        super();
    }

    private broadcast(event: UiEvent) {
        this.emit('event', event);
    }

    snapshot() {
        return {
            tree: this.tree,
            tests: [...this.tests.values()],
            run: this.run,
            output: this.output,
            error: this.error
        };
    }

    isBusy() {
        return this.run.state !== 'idle';
    }

    private setRun(run: RunInfo) {
        this.run = run;
        this.broadcast({ type: 'run', run });
    }

    private setError(message: string | null) {
        this.error = message;
        this.broadcast({ type: 'error', message });
    }

    private appendOutput(text: string, stream: 'stdout' | 'stderr') {
        this.output.push({ text, stream });
        this.outputSize += text.length;
        while (this.outputSize > MAX_OUTPUT && this.output.length > 1) {
            this.outputSize -= this.output.shift()!.text.length;
        }
        this.broadcast({ type: 'output', text, stream });
    }

    clearOutput() {
        this.output = [];
        this.outputSize = 0;
    }

    private forkWorker(): ChildProcess {
        if (this.options.forkWorker) return this.options.forkWorker(this.options.args);
        return fork(resolve(__dirname, 'worker.js'), this.options.args, {
            cwd: this.options.cwd,
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
            detached: process.platform !== 'win32'
        });
    }

    /**
     * Run cucumber in a child process and feed its messages to processor
     */
    private execute(overrides: RunOverrides, processor: EnvelopeProcessor): Promise<{ success: boolean, fatal?: string }> {
        return new Promise(resolvePromise => {
            const child = this.forkWorker();
            this.child = child;
            let outcome: { success: boolean, fatal?: string } | null = null;
            let graceTimer: NodeJS.Timeout | undefined;
            child.stdout?.on('data', (chunk: Buffer) => this.appendOutput(chunk.toString(), 'stdout'));
            child.stderr?.on('data', (chunk: Buffer) => this.appendOutput(chunk.toString(), 'stderr'));
            child.on('message', (message: any) => {
                if (message?.type === 'envelope') processor.process(message.envelope);
                if (message?.type === 'done') outcome = { success: message.success };
                if (message?.type === 'fatal') outcome = { success: false, fatal: message.message };
                if (outcome && !graceTimer) {
                    // user code may keep handles open (e.g. a browser), do not wait forever
                    graceTimer = setTimeout(() => this.kill(child), EXIT_GRACE_TIMEOUT);
                    graceTimer.unref();
                }
            });
            let exitCode: number | null | undefined;
            let exited = false;
            let disconnected = false;
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                clearTimeout(graceTimer);
                if (this.child === child) this.child = null;
                resolvePromise(outcome ?? {
                    success: false,
                    fatal: this.stopRequested ? undefined : `Worker exited with code ${exitCode}`
                });
            };
            // wait for both: process exit and ipc channel close (all messages are delivered)
            child.once('exit', (code) => {
                exited = true;
                exitCode = code;
                if (disconnected || !child.connected) finish();
            });
            child.once('disconnect', () => {
                disconnected = true;
                if (exited) finish();
            });
            child.once('error', (err) => {
                outcome = outcome ?? { success: false, fatal: err.stack ?? String(err) };
                finish();
            });
            child.send(overrides);
        });
    }

    private kill(child: ChildProcess) {
        if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
        const signal = (sig: NodeJS.Signals) => {
            try {
                if (process.platform === 'win32') {
                    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
                } else if (this.options.forkWorker) {
                    child.kill(sig);
                } else {
                    // kill the whole process group (parallel workers, browsers etc.)
                    process.kill(-child.pid!, sig);
                }
            } catch {
                child.kill(sig);
            }
        };
        signal('SIGTERM');
        setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) signal('SIGKILL');
        }, KILL_TIMEOUT).unref();
    }

    /**
     * Load features and support code in dry-run mode to build the test tree
     */
    async discover(): Promise<void> {
        if (this.isBusy()) return;
        this.setRun({ ...this.run, state: 'discovering' });
        const parseErrors: string[] = [];
        const processor = new EnvelopeProcessor({ onParseError: message => parseErrors.push(message) }, true);
        const result = await this.execute({
            dryRun: true,
            parallel: 0,
            format: [[this.formatterPath]],
            skipExecutionHooks: true
        }, processor);
        const fatal = result.fatal ?? (parseErrors.length ? parseErrors.join('\n') : null);
        if (fatal && processor.plannedTestIds.length === 0) {
            this.setError(fatal);
        } else {
            this.setError(parseErrors.length ? parseErrors.join('\n') : null);
            this.tree = processor.buildTree();
            const tests = new Map<string, TestView>();
            for (const discovered of processor.allTests()) {
                tests.set(discovered.id, this.mergeDiscovered(discovered));
            }
            this.tests = tests;
            this.broadcast({ type: 'tree', tree: this.tree, tests: [...tests.values()] });
        }
        this.setRun({ ...this.run, state: 'idle' });
    }

    /**
     * Keep previous run results if scenario has not changed
     */
    private mergeDiscovered(discovered: TestView): TestView {
        const previous = this.tests.get(discovered.id);
        const signature = (test: TestView) => JSON.stringify([test.name, test.steps.map(s => [s.kind, s.keyword, s.text, s.docString, s.dataTable])]);
        if (!previous || ['idle', 'queued', 'running'].includes(previous.status) || discovered.status !== 'idle') {
            return discovered;
        }
        if (signature(previous) !== signature(discovered)) return discovered;
        return { ...discovered, status: previous.status, duration: previous.duration, error: previous.error, attempt: previous.attempt, steps: previous.steps };
    }

    /**
     * Run tests by ids. Undefined means all discovered tests.
     */
    async runTests(ids?: string[]): Promise<boolean> {
        if (this.isBusy()) return false;
        if (this.tree.length === 0) await this.discover();
        const known = (ids ?? [...this.tests.keys()]).filter(id => this.tests.has(id));
        if (known.length === 0) return false;
        this.stopRequested = false;
        this.clearOutput();
        for (const id of known) {
            const test = this.tests.get(id)!;
            this.releaseAttachments(test);
            test.status = 'queued';
            test.error = undefined;
            test.duration = undefined;
            test.steps = test.steps.map(step => ({ ...step, status: 'queued', duration: undefined, error: undefined, attachments: [] }));
            this.broadcast({ type: 'test', test });
        }
        this.setRun({ state: 'running', startedAt: Date.now(), testIds: known });
        const processor = new EnvelopeProcessor({
            onTest: test => {
                const copy = structuredClone(test);
                this.tests.set(test.id, copy);
                this.broadcast({ type: 'test', test: copy });
            },
            onAttachment: (id, attachment) => this.attachments.set(id, attachment)
        });
        const paths = ids ? toCucumberPaths(known, this.tree) : undefined;
        const result = await this.execute({ paths, format: [[this.formatterPath]] }, processor);
        for (const id of known) {
            const test = this.tests.get(id);
            if (!test || !['queued', 'running'].includes(test.status)) continue;
            test.status = test.status === 'running' ? 'interrupted' : 'idle';
            test.steps = test.steps.map(step => ['queued', 'running'].includes(step.status)
                ? { ...step, status: step.status === 'running' ? 'interrupted' : 'idle' }
                : step
            );
            this.broadcast({ type: 'test', test });
        }
        this.setRun({ ...this.run, state: 'idle', finishedAt: Date.now(), error: result.fatal });
        if (result.fatal) this.appendOutput(result.fatal + '\n', 'stderr');
        return true;
    }

    private releaseAttachments(test: TestView) {
        for (const step of test.steps) {
            for (const attachment of step.attachments) this.attachments.delete(attachment.id);
        }
    }

    stop() {
        if (!this.child) return;
        this.stopRequested = true;
        this.kill(this.child);
    }

    dispose() {
        this.stop();
        this.removeAllListeners();
    }
}
