import { describe, expect, test } from 'vitest';
import { mergeConfig } from '../src/mergeConfig';

class Memory {
    get computed() { return 'from prototype'; }
}

describe('mergeConfig', () => {
    test('appends additive arrays like cucumber does', () => {
        const merged = mergeConfig(
            { format: [['junit', 'report.xml']], require: ['steps/*.js'], import: 'esm/*.js' },
            { format: ['progress'], require: ['extra/*.js'], import: ['more/*.js'] }
        );
        expect(merged.format).toEqual([['junit', 'report.xml'], 'progress']);
        expect(merged.require).toEqual(['steps/*.js', 'extra/*.js']);
        expect(merged.import).toEqual(['esm/*.js', 'more/*.js']);
    });

    test('cli paths replace config paths', () => {
        expect(mergeConfig({ paths: ['features/**'] }, { paths: ['features/login.feature:12'] }).paths)
            .toEqual(['features/login.feature:12']);
    });

    test('tag expressions are combined with and', () => {
        expect(mergeConfig({ tags: 'not @wip' }, { tags: '(@smoke)' }).tags).toBe('(not @wip) and (@smoke)');
        expect(mergeConfig({ retryTagFilter: '@flaky' }, { retryTagFilter: '@net' }).retryTagFilter).toBe('(@flaky) and (@net)');
        expect(mergeConfig({}, { tags: '@smoke' }).tags).toBe('@smoke');
        expect(mergeConfig({ tags: '@smoke' }, {}).tags).toBe('@smoke');
    });

    test('plain objects are merged recursively', () => {
        const merged = mergeConfig(
            { worldParameters: { a: 1, nested: { x: 1, y: 2 } } },
            { worldParameters: { b: 2, nested: { y: 3 } } }
        );
        expect(merged.worldParameters).toEqual({ a: 1, b: 2, nested: { x: 1, y: 3 } });
    });

    test('scalars are replaced and undefined cli values are ignored', () => {
        expect(mergeConfig({ parallel: 2, retry: 1 }, { parallel: 4, retry: undefined })).toEqual({ parallel: 4, retry: 1 });
    });

    test('does not mutate inputs', () => {
        const config = { paths: ['a'], format: ['progress'], worldParameters: { a: 1 }, tags: '@a' };
        const snapshot = structuredClone(config);
        const cli = { paths: ['b'], format: ['json'], worldParameters: { b: 2 }, tags: '@b' };
        mergeConfig(config, cli);
        expect(config).toEqual(snapshot);
        expect(cli).toEqual({ paths: ['b'], format: ['json'], worldParameters: { b: 2 }, tags: '@b' });
    });

    test('keeps class instances by reference', () => {
        const memory = new Memory();
        const merged = mergeConfig({ memory }, { parallel: 1 });
        expect(merged.memory).toBe(memory);
        expect(merged.memory.computed).toBe('from prototype');
    });
});
