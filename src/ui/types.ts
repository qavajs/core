export type TestStatus =
    | 'idle'
    | 'queued'
    | 'running'
    | 'passed'
    | 'failed'
    | 'skipped'
    | 'pending'
    | 'undefined'
    | 'ambiguous'
    | 'interrupted';

export interface AttachmentView {
    id: string;
    mediaType: string;
    fileName?: string;
    size: number;
    /** text content for small textual attachments (logs, json, plain text) */
    text?: string;
}

export interface StepView {
    id: string;
    kind: 'hook' | 'step';
    keyword: string;
    text: string;
    line?: number;
    status: TestStatus;
    duration?: number;
    error?: string;
    docString?: string;
    dataTable?: string[][];
    attachments: AttachmentView[];
}

export interface TestView {
    /** stable id: `${uri}:${line}` */
    id: string;
    uri: string;
    line: number;
    name: string;
    feature: string;
    rule?: string;
    outline?: string;
    tags: string[];
    status: TestStatus;
    duration?: number;
    error?: string;
    attempt: number;
    steps: StepView[];
}

export interface TreeNode {
    kind: 'feature' | 'rule' | 'outline' | 'test';
    id: string;
    name: string;
    uri: string;
    line: number;
    children?: TreeNode[];
}

export interface RunInfo {
    state: 'idle' | 'discovering' | 'running';
    startedAt?: number;
    finishedAt?: number;
    testIds: string[];
    error?: string;
}

export type UiEvent =
    | { type: 'tree'; tree: TreeNode[]; tests: TestView[] }
    | { type: 'test'; test: TestView }
    | { type: 'run'; run: RunInfo }
    | { type: 'output'; text: string; stream: 'stdout' | 'stderr' }
    | { type: 'error'; message: string | null };
