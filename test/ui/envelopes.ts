/**
 * Builds a minimal cucumber message stream for:
 *
 * 1 Feature: Demo
 * 3   Background:
 * 4     Given background
 * 6   Scenario: plain
 * 7     When step one
 * 9   Rule: my rule
 * 10    Scenario Outline: outline <n>
 * 11      Then check <n>
 * 13      Examples:
 * 14        | n |
 * 15        | 1 |
 * 16        | 2 |
 */
export function gherkinEnvelopes(uri = 'features/demo.feature') {
    const loc = (line: number) => ({ line, column: 1 });
    return [
        {
            gherkinDocument: {
                uri,
                feature: {
                    name: 'Demo',
                    location: loc(1),
                    children: [
                        { background: { id: 'bg', location: loc(3), steps: [{ id: 'bg-step', keyword: 'Given ', text: 'background', location: loc(4) }] } },
                        { scenario: { id: 'sc1', name: 'plain', keyword: 'Scenario', location: loc(6), steps: [{ id: 'sc1-step', keyword: 'When ', text: 'step one', location: loc(7) }], examples: [] } },
                        {
                            rule: {
                                id: 'rule', name: 'my rule', location: loc(9), children: [{
                                    scenario: {
                                        id: 'sc2', name: 'outline <n>', keyword: 'Scenario Outline', location: loc(10),
                                        steps: [{ id: 'sc2-step', keyword: 'Then ', text: 'check <n>', location: loc(11) }],
                                        examples: [{ tableBody: [{ id: 'row1', location: loc(15) }, { id: 'row2', location: loc(16) }] }]
                                    }
                                }]
                            }
                        }
                    ]
                }
            }
        },
        { hook: { id: 'hook1', name: 'init' } },
        { pickle: { id: 'p1', uri, name: 'plain', tags: [{ name: '@smoke' }], astNodeIds: ['sc1'], steps: [
            { id: 'p1s1', text: 'background', astNodeIds: ['bg-step'] },
            { id: 'p1s2', text: 'step one', astNodeIds: ['sc1-step'], argument: { dataTable: { rows: [{ cells: [{ value: 'a' }, { value: 'b' }] }] } } }
        ] } },
        { pickle: { id: 'p2', uri, name: 'outline 1', tags: [], astNodeIds: ['sc2', 'row1'], steps: [
            { id: 'p2s1', text: 'check 1', astNodeIds: ['sc2-step', 'row1'] }
        ] } },
        { pickle: { id: 'p3', uri, name: 'outline 2', tags: [], astNodeIds: ['sc2', 'row2'], steps: [
            { id: 'p3s1', text: 'check 2', astNodeIds: ['sc2-step', 'row2'], argument: { docString: { content: 'doc' } } }
        ] } },
        { testCase: { id: 'tc1', pickleId: 'p1', testSteps: [
            { id: 'ts-hook', hookId: 'hook1' },
            { id: 'ts1', pickleStepId: 'p1s1', stepDefinitionIds: ['d1'] },
            { id: 'ts2', pickleStepId: 'p1s2', stepDefinitionIds: ['d2'] }
        ] } },
        { testCase: { id: 'tc2', pickleId: 'p2', testSteps: [{ id: 'ts3', pickleStepId: 'p2s1', stepDefinitionIds: [] }] } },
        { testCase: { id: 'tc3', pickleId: 'p3', testSteps: [{ id: 'ts4', pickleStepId: 'p3s1', stepDefinitionIds: ['d3', 'd4'] }] } },
    ];
}

export const duration = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1e6 });

export function executionEnvelopes() {
    return [
        { testCaseStarted: { id: 'tcs1', testCaseId: 'tc1', attempt: 0 } },
        { testStepStarted: { testCaseStartedId: 'tcs1', testStepId: 'ts-hook' } },
        { testStepFinished: { testCaseStartedId: 'tcs1', testStepId: 'ts-hook', testStepResult: { status: 'PASSED', duration: duration(5) } } },
        { testStepStarted: { testCaseStartedId: 'tcs1', testStepId: 'ts1' } },
        { attachment: { testCaseStartedId: 'tcs1', testStepId: 'ts1', body: 'hello', mediaType: 'text/x.cucumber.log+plain', contentEncoding: 'IDENTITY' } },
        { attachment: { testCaseStartedId: 'tcs1', testStepId: 'ts1', body: Buffer.from('png').toString('base64'), mediaType: 'image/png', contentEncoding: 'BASE64', fileName: 'shot.png' } },
        { testStepFinished: { testCaseStartedId: 'tcs1', testStepId: 'ts1', testStepResult: { status: 'PASSED', duration: duration(1500) } } },
        { testStepStarted: { testCaseStartedId: 'tcs1', testStepId: 'ts2' } },
        { testStepFinished: { testCaseStartedId: 'tcs1', testStepId: 'ts2', testStepResult: { status: 'FAILED', duration: duration(10), message: 'Error: boom' } } },
        { testCaseFinished: { testCaseStartedId: 'tcs1', willBeRetried: false } },
    ];
}
