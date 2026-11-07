import type { AttachmentView, StepView, TestStatus, TestView, TreeNode } from './types';

/**
 * Minimal structural typings of cucumber messages used by ui mode
 * (avoids a hard dependency on @cucumber/messages)
 */
export interface Envelope {
    [key: string]: any;
}

interface AstNode {
    line: number;
    keyword?: string;
    name?: string;
}

interface ScenarioInfo extends AstNode {
    uri: string;
    rule?: AstNode;
    hasExamples: boolean;
}

export interface StoredAttachment {
    body: Buffer;
    mediaType: string;
    fileName?: string;
}

export interface ProcessorCallbacks {
    onTest?(test: TestView): void;
    onAttachment?(id: string, attachment: StoredAttachment): void;
    onParseError?(message: string): void;
}

const STATUS_PRIORITY: TestStatus[] = [
    'failed', 'ambiguous', 'undefined', 'pending', 'interrupted', 'skipped', 'passed'
];
const INLINE_TEXT_LIMIT = 64 * 1024;
const LOG_MEDIA_TYPE = 'text/x.cucumber.log+plain';

export function toStatus(status: string | undefined): TestStatus {
    const normalized = String(status ?? '').toLowerCase();
    switch (normalized) {
        case 'passed':
        case 'failed':
        case 'skipped':
        case 'pending':
        case 'undefined':
        case 'ambiguous':
            return normalized;
        default:
            return 'failed';
    }
}

export function worstStatus(statuses: TestStatus[]): TestStatus {
    for (const status of STATUS_PRIORITY) {
        if (statuses.includes(status)) return status;
    }
    return 'passed';
}

function durationToMs(duration?: { seconds: number | string; nanos: number }): number | undefined {
    if (!duration) return undefined;
    return Number(duration.seconds) * 1000 + Math.round(duration.nanos / 1e6);
}

function isTextual(mediaType: string) {
    return mediaType.startsWith('text/') || mediaType === 'application/json';
}

let attachmentCounter = 0;

/**
 * Turns cucumber message envelopes of a single cucumber run into ui view models.
 * One instance must be used per run because message ids are unique per run only.
 */
export class EnvelopeProcessor {
    private astNodes = new Map<string, AstNode>();
    private scenarios = new Map<string, ScenarioInfo>();
    private featureNames = new Map<string, string>();
    private pickles = new Map<string, any>();
    private hooks = new Map<string, any>();
    private testCases = new Map<string, any>();
    private testCaseStarted = new Map<string, { testId: string, testCaseId: string }>();
    private tests = new Map<string, TestView>();

    /** tests that have a test case in this run, in execution plan order */
    readonly plannedTestIds: string[] = [];

    constructor(private callbacks: ProcessorCallbacks = {}, private discovery = false) {}

    getTest(id: string) {
        return this.tests.get(id);
    }

    process(envelope: Envelope) {
        if (envelope.gherkinDocument) this.onGherkinDocument(envelope.gherkinDocument);
        else if (envelope.pickle) this.pickles.set(envelope.pickle.id, envelope.pickle);
        else if (envelope.hook) this.hooks.set(envelope.hook.id, envelope.hook);
        else if (envelope.testCase) this.onTestCase(envelope.testCase);
        else if (envelope.parseError) this.callbacks.onParseError?.(
            `${envelope.parseError.source?.uri ?? ''}: ${envelope.parseError.message}`
        );
        // dry-run reports every step as skipped: discovery only needs the plan
        else if (this.discovery) return;
        else if (envelope.testCaseStarted) this.onTestCaseStarted(envelope.testCaseStarted);
        else if (envelope.testStepStarted) this.onTestStepStarted(envelope.testStepStarted);
        else if (envelope.testStepFinished) this.onTestStepFinished(envelope.testStepFinished);
        else if (envelope.attachment) this.onAttachment(envelope.attachment);
        else if (envelope.testCaseFinished) this.onTestCaseFinished(envelope.testCaseFinished);
    }

    private onGherkinDocument(document: any) {
        const feature = document.feature;
        if (!feature) return;
        this.featureNames.set(document.uri, feature.name);
        const indexSteps = (steps: any[] = []) => {
            for (const step of steps) {
                this.astNodes.set(step.id, { line: step.location.line, keyword: step.keyword });
            }
        };
        const indexScenario = (scenario: any, rule?: AstNode) => {
            this.astNodes.set(scenario.id, { line: scenario.location.line, name: scenario.name });
            this.scenarios.set(scenario.id, {
                uri: document.uri,
                line: scenario.location.line,
                name: scenario.name,
                keyword: scenario.keyword,
                rule,
                hasExamples: (scenario.examples ?? []).length > 0
            });
            indexSteps(scenario.steps);
            for (const examples of scenario.examples ?? []) {
                for (const row of examples.tableBody ?? []) {
                    this.astNodes.set(row.id, { line: row.location.line });
                }
            }
        };
        const indexChildren = (children: any[] = [], rule?: AstNode) => {
            for (const child of children) {
                if (child.background) indexSteps(child.background.steps);
                if (child.scenario) indexScenario(child.scenario, rule);
                if (child.rule) {
                    const ruleNode = { line: child.rule.location.line, name: child.rule.name };
                    indexChildren(child.rule.children, ruleNode);
                }
            }
        };
        indexChildren(feature.children);
    }

    private pickleLine(pickle: any): number {
        if (pickle.location?.line) return pickle.location.line;
        const lastNode = pickle.astNodeIds[pickle.astNodeIds.length - 1];
        return this.astNodes.get(lastNode)?.line ?? 0;
    }

    private onTestCase(testCase: any) {
        const pickle = this.pickles.get(testCase.pickleId);
        if (!pickle) return;
        const scenario = this.scenarios.get(pickle.astNodeIds[0]);
        const id = `${pickle.uri}:${this.pickleLine(pickle)}`;
        const pickleSteps = new Map<string, any>(pickle.steps.map((step: any) => [step.id, step]));
        let seenPickleStep = false;
        const steps: StepView[] = testCase.testSteps.map((testStep: any): StepView => {
            if (testStep.pickleStepId) {
                seenPickleStep = true;
                const pickleStep = pickleSteps.get(testStep.pickleStepId);
                const astNode = this.astNodes.get(pickleStep?.astNodeIds?.[0]);
                const argument = pickleStep?.argument;
                const step: StepView = {
                    id: testStep.id,
                    kind: 'step',
                    keyword: astNode?.keyword?.trim() ?? '',
                    text: pickleStep?.text ?? '',
                    line: astNode?.line,
                    status: 'idle',
                    attachments: []
                };
                if (argument?.docString) step.docString = argument.docString.content;
                if (argument?.dataTable) {
                    step.dataTable = argument.dataTable.rows.map((row: any) => row.cells.map((cell: any) => cell.value));
                }
                if (this.discovery && testStep.stepDefinitionIds?.length === 0) step.status = 'undefined';
                if (this.discovery && testStep.stepDefinitionIds?.length > 1) step.status = 'ambiguous';
                return step;
            }
            const hook = this.hooks.get(testStep.hookId);
            return {
                id: testStep.id,
                kind: 'hook',
                keyword: seenPickleStep ? 'After' : 'Before',
                text: hook?.name ?? '',
                status: 'idle',
                attachments: []
            };
        });
        const test: TestView = {
            id,
            uri: pickle.uri,
            line: this.pickleLine(pickle),
            name: pickle.name,
            feature: this.featureNames.get(pickle.uri) ?? pickle.uri,
            rule: scenario?.rule?.name,
            outline: scenario?.hasExamples ? scenario.name : undefined,
            tags: pickle.tags.map((tag: any) => tag.name),
            status: 'idle',
            attempt: 0,
            steps
        };
        if (this.discovery) {
            const stepStatuses = steps.map(step => step.status);
            if (stepStatuses.includes('undefined')) test.status = 'undefined';
            if (stepStatuses.includes('ambiguous')) test.status = 'ambiguous';
        }
        this.testCases.set(testCase.id, { testId: id, testCase });
        if (!this.tests.has(id)) this.plannedTestIds.push(id);
        this.tests.set(id, test);
    }

    private resetTest(test: TestView) {
        test.status = 'running';
        test.error = undefined;
        test.duration = undefined;
        for (const step of test.steps) {
            step.status = 'queued';
            step.duration = undefined;
            step.error = undefined;
            step.attachments = [];
        }
    }

    private onTestCaseStarted(started: any) {
        const testCase = this.testCases.get(started.testCaseId);
        if (!testCase) return;
        const test = this.tests.get(testCase.testId)!;
        this.testCaseStarted.set(started.id, { testId: testCase.testId, testCaseId: started.testCaseId });
        this.resetTest(test);
        test.attempt = started.attempt ?? 0;
        this.emit(test);
    }

    private findStep(testCaseStartedId: string, testStepId: string) {
        const started = this.testCaseStarted.get(testCaseStartedId);
        if (!started) return {};
        const test = this.tests.get(started.testId)!;
        const step = test.steps.find(s => s.id === testStepId);
        return { test, step };
    }

    private onTestStepStarted(stepStarted: any) {
        const { test, step } = this.findStep(stepStarted.testCaseStartedId, stepStarted.testStepId);
        if (!test || !step) return;
        step.status = 'running';
        this.emit(test);
    }

    private onTestStepFinished(stepFinished: any) {
        const { test, step } = this.findStep(stepFinished.testCaseStartedId, stepFinished.testStepId);
        if (!test || !step) return;
        const result = stepFinished.testStepResult;
        step.status = toStatus(result.status);
        step.duration = durationToMs(result.duration);
        const error = result.message ?? result.exception?.message;
        if (error && step.status !== 'passed') step.error = error;
        this.emit(test);
    }

    private onAttachment(attachment: any) {
        if (!attachment.testCaseStartedId) return;
        const { test, step } = this.findStep(attachment.testCaseStartedId, attachment.testStepId);
        if (!test || !step) return;
        const body = attachment.contentEncoding === 'BASE64'
            ? Buffer.from(attachment.body, 'base64')
            : Buffer.from(attachment.body, 'utf-8');
        const view: AttachmentView = {
            id: `a${++attachmentCounter}`,
            mediaType: attachment.mediaType,
            fileName: attachment.fileName,
            size: body.length
        };
        if (isTextual(attachment.mediaType) && body.length <= INLINE_TEXT_LIMIT) {
            view.text = body.toString('utf-8');
        }
        step.attachments.push(view);
        this.callbacks.onAttachment?.(view.id, {
            body,
            mediaType: attachment.mediaType === LOG_MEDIA_TYPE ? 'text/plain' : attachment.mediaType,
            fileName: attachment.fileName
        });
        this.emit(test);
    }

    private onTestCaseFinished(finished: any) {
        const started = this.testCaseStarted.get(finished.testCaseStartedId);
        if (!started) return;
        const test = this.tests.get(started.testId)!;
        const statuses = test.steps.map(step => step.status === 'queued' ? 'skipped' : step.status);
        test.steps.forEach((step, index) => step.status = statuses[index]);
        test.status = worstStatus(statuses);
        test.duration = test.steps.reduce((sum, step) => sum + (step.duration ?? 0), 0);
        test.error = test.steps.find(step => step.error)?.error;
        if (finished.willBeRetried) test.status = 'running';
        this.emit(test);
    }

    private emit(test: TestView) {
        this.callbacks.onTest?.(test);
    }

    /**
     * Build tree of features -> rules -> outlines -> tests from tests planned in this run
     */
    buildTree(): TreeNode[] {
        const features = new Map<string, TreeNode>();
        const groups = new Map<string, TreeNode>();
        const testsByUri = [...this.testCases.values()]
            .map(({ testCase }) => this.pickles.get(testCase.pickleId))
            .filter((pickle, index, all) => all.indexOf(pickle) === index);
        const seen = new Set<string>();
        for (const pickle of testsByUri) {
            const test = this.tests.get(`${pickle.uri}:${this.pickleLine(pickle)}`)!;
            if (seen.has(test.id)) continue;
            seen.add(test.id);
            if (!features.has(pickle.uri)) {
                features.set(pickle.uri, {
                    kind: 'feature',
                    id: pickle.uri,
                    name: test.feature,
                    uri: pickle.uri,
                    line: 1,
                    children: []
                });
            }
            let parent = features.get(pickle.uri)!;
            const scenario = this.scenarios.get(pickle.astNodeIds[0]);
            if (scenario?.rule) {
                const ruleId = `${pickle.uri}:${scenario.rule.line}`;
                if (!groups.has(ruleId)) {
                    const rule: TreeNode = {
                        kind: 'rule', id: ruleId, name: scenario.rule.name ?? '', uri: pickle.uri, line: scenario.rule.line, children: []
                    };
                    groups.set(ruleId, rule);
                    parent.children!.push(rule);
                }
                parent = groups.get(ruleId)!;
            }
            if (scenario?.hasExamples) {
                const outlineId = `${pickle.uri}:${scenario.line}`;
                if (!groups.has(outlineId)) {
                    const outline: TreeNode = {
                        kind: 'outline', id: outlineId, name: scenario.name ?? '', uri: pickle.uri, line: scenario.line, children: []
                    };
                    groups.set(outlineId, outline);
                    parent.children!.push(outline);
                }
                parent = groups.get(outlineId)!;
            }
            parent.children!.push({ kind: 'test', id: test.id, name: test.name, uri: test.uri, line: test.line });
        }
        const sortChildren = (nodes: TreeNode[]) => {
            nodes.sort((a, b) => a.line - b.line);
            nodes.forEach(node => node.children && sortChildren(node.children));
        };
        const tree = [...features.values()].sort((a, b) => a.uri.localeCompare(b.uri));
        tree.forEach(feature => sortChildren(feature.children!));
        return tree;
    }

    allTests(): TestView[] {
        return this.plannedTestIds.map(id => this.tests.get(id)!);
    }
}

/**
 * Convert list of test ids to cucumber paths, collapsing fully selected features to a single uri
 */
export function toCucumberPaths(testIds: string[], tree: TreeNode[]): string[] {
    const allByUri = new Map<string, number>();
    const collect = (node: TreeNode) => {
        if (node.kind === 'test') allByUri.set(node.uri, (allByUri.get(node.uri) ?? 0) + 1);
        node.children?.forEach(collect);
    };
    tree.forEach(collect);
    const selected = new Map<string, number[]>();
    for (const id of testIds) {
        const separator = id.lastIndexOf(':');
        const uri = id.slice(0, separator);
        const line = Number(id.slice(separator + 1));
        if (!selected.has(uri)) selected.set(uri, []);
        selected.get(uri)!.push(line);
    }
    return [...selected.entries()].map(([uri, lines]) => {
        const unique = [...new Set(lines)].sort((a, b) => a - b);
        return unique.length === allByUri.get(uri) ? uri : `${uri}:${unique.join(':')}`;
    });
}
