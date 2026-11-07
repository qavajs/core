import { test, expect, describe } from 'vitest';
import { EnvelopeProcessor, toCucumberPaths, worstStatus, toStatus } from '../../src/ui/processor';
import { gherkinEnvelopes, executionEnvelopes, duration } from './envelopes';

describe('discovery', () => {
    test('builds tree with features, rules and outlines', () => {
        const processor = new EnvelopeProcessor({}, true);
        gherkinEnvelopes().forEach(e => processor.process(e));
        const tree = processor.buildTree();
        expect(tree).toEqual([{
            kind: 'feature', id: 'features/demo.feature', name: 'Demo', uri: 'features/demo.feature', line: 1,
            children: [
                { kind: 'test', id: 'features/demo.feature:6', name: 'plain', uri: 'features/demo.feature', line: 6 },
                {
                    kind: 'rule', id: 'features/demo.feature:9', name: 'my rule', uri: 'features/demo.feature', line: 9,
                    children: [{
                        kind: 'outline', id: 'features/demo.feature:10', name: 'outline <n>', uri: 'features/demo.feature', line: 10,
                        children: [
                            { kind: 'test', id: 'features/demo.feature:15', name: 'outline 1', uri: 'features/demo.feature', line: 15 },
                            { kind: 'test', id: 'features/demo.feature:16', name: 'outline 2', uri: 'features/demo.feature', line: 16 },
                        ]
                    }]
                }
            ]
        }]);
    });

    test('maps test views with steps, hooks, arguments and metadata', () => {
        const processor = new EnvelopeProcessor({}, true);
        gherkinEnvelopes().forEach(e => processor.process(e));
        const [plain, outline1, outline2] = processor.allTests();
        expect(plain).toMatchObject({ name: 'plain', feature: 'Demo', tags: ['@smoke'], status: 'idle', rule: undefined, outline: undefined });
        expect(plain.steps.map(s => [s.kind, s.keyword, s.text, s.line])).toEqual([
            ['hook', 'Before', 'init', undefined],
            ['step', 'Given', 'background', 4],
            ['step', 'When', 'step one', 7],
        ]);
        expect(plain.steps[2].dataTable).toEqual([['a', 'b']]);
        expect(outline1).toMatchObject({ rule: 'my rule', outline: 'outline <n>', status: 'undefined' });
        expect(outline2.status).toBe('ambiguous');
        expect(outline2.steps[0].docString).toBe('doc');
    });

    test('ignores dry-run execution messages', () => {
        const processor = new EnvelopeProcessor({}, true);
        [...gherkinEnvelopes(), ...executionEnvelopes()].forEach(e => processor.process(e));
        expect(processor.getTest('features/demo.feature:6')!.status).toBe('idle');
    });

    test('reports parse errors', () => {
        const errors: string[] = [];
        const processor = new EnvelopeProcessor({ onParseError: m => errors.push(m) }, true);
        processor.process({ parseError: { source: { uri: 'a.feature' }, message: '(1:1): expected' } });
        expect(errors).toEqual(['a.feature: (1:1): expected']);
    });
});

describe('execution', () => {
    test('tracks step results, durations, errors and attachments', () => {
        const updates: string[] = [];
        const attachments = new Map<string, any>();
        const processor = new EnvelopeProcessor({
            onTest: t => updates.push(t.status),
            onAttachment: (id, a) => attachments.set(id, a)
        });
        [...gherkinEnvelopes(), ...executionEnvelopes()].forEach(e => processor.process(e));
        const result = processor.getTest('features/demo.feature:6')!;
        expect(updates[0]).toBe('running');
        expect(updates.at(-1)).toBe('failed');
        expect(result.status).toBe('failed');
        expect(result.duration).toBe(1515);
        expect(result.error).toBe('Error: boom');
        expect(result.steps.map(s => s.status)).toEqual(['passed', 'passed', 'failed']);
        const [log, image] = result.steps[1].attachments;
        expect(log).toMatchObject({ mediaType: 'text/x.cucumber.log+plain', text: 'hello', size: 5 });
        expect(image).toMatchObject({ mediaType: 'image/png', fileName: 'shot.png', size: 3 });
        expect(image.text).toBeUndefined();
        expect(attachments.get(log.id).mediaType).toBe('text/plain');
        expect(attachments.get(image.id).body.toString()).toBe('png');
    });

    test('marks unfinished steps as skipped and keeps running status on retry', () => {
        const processor = new EnvelopeProcessor();
        gherkinEnvelopes().forEach(e => processor.process(e));
        processor.process({ testCaseStarted: { id: 'tcs', testCaseId: 'tc1', attempt: 0 } });
        processor.process({ testStepFinished: { testCaseStartedId: 'tcs', testStepId: 'ts-hook', testStepResult: { status: 'FAILED', duration: duration(1), exception: { message: 'hook failed' } } } });
        processor.process({ testCaseFinished: { testCaseStartedId: 'tcs', willBeRetried: true } });
        const test = processor.getTest('features/demo.feature:6')!;
        expect(test.steps.map(s => s.status)).toEqual(['failed', 'skipped', 'skipped']);
        expect(test.error).toBe('hook failed');
        expect(test.status).toBe('running');
        processor.process({ testCaseStarted: { id: 'tcs2', testCaseId: 'tc1', attempt: 1 } });
        expect(test.attempt).toBe(1);
        expect(test.error).toBeUndefined();
        expect(test.steps.map(s => s.status)).toEqual(['queued', 'queued', 'queued']);
    });

    test('ignores messages for unknown test cases', () => {
        const processor = new EnvelopeProcessor();
        expect(() => {
            processor.process({ testCase: { id: 'x', pickleId: 'unknown', testSteps: [] } });
            processor.process({ testCaseStarted: { id: 'a', testCaseId: 'unknown' } });
            processor.process({ testStepStarted: { testCaseStartedId: 'a', testStepId: 'b' } });
            processor.process({ attachment: { testCaseStartedId: 'a', testStepId: 'b', body: '' } });
            processor.process({ attachment: { body: 'global attachment' } });
            processor.process({ testCaseFinished: { testCaseStartedId: 'a' } });
        }).not.toThrow();
    });
});

test('toCucumberPaths collapses fully selected features', () => {
    const processor = new EnvelopeProcessor({}, true);
    gherkinEnvelopes('a.feature').forEach(e => processor.process(e));
    const tree = processor.buildTree();
    expect(toCucumberPaths(['a.feature:16', 'a.feature:6'], tree)).toEqual(['a.feature:6:16']);
    expect(toCucumberPaths(['a.feature:6', 'a.feature:15', 'a.feature:16'], tree)).toEqual(['a.feature']);
    expect(toCucumberPaths(['b/c:d.feature:3'], tree)).toEqual(['b/c:d.feature:3']);
});

test('status helpers', () => {
    expect(toStatus('PASSED')).toBe('passed');
    expect(toStatus('UNKNOWN')).toBe('failed');
    expect(worstStatus(['passed', 'skipped', 'failed'])).toBe('failed');
    expect(worstStatus(['passed', 'skipped'])).toBe('skipped');
    expect(worstStatus([])).toBe('passed');
});
