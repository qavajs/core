import { describe, test, expect } from 'vitest';
import { cliOptions, findTypos } from '../src/cliOptions';

describe('cliOptions', () => {
    test('maps --parallel to number', () => {
        const result = cliOptions(['node', 'script', '--parallel', '4']);
        expect(result.parallel).toBe(4);
    });

    test('maps --retry to number', () => {
        const result = cliOptions(['node', 'script', '--retry', '2']);
        expect(result.retry).toBe(2);
    });

    test('parallel is undefined when not provided', () => {
        const result = cliOptions(['node', 'script']);
        expect(result.parallel).toBeUndefined();
    });

    test('retry is undefined when not provided', () => {
        const result = cliOptions(['node', 'script']);
        expect(result.retry).toBeUndefined();
    });

    test('sets errorExit=false for --no-error-exit', () => {
        const result = cliOptions(['node', 'script', '--no-error-exit']);
        expect(result.errorExit).toBe(false);
    });

    test('maps --dry-run to dryRun', () => {
        const result = cliOptions(['node', 'script', '--dry-run']);
        expect(result.dryRun).toBe(true);
    });

    test('maps --fail-fast to failFast', () => {
        const result = cliOptions(['node', 'script', '--fail-fast']);
        expect(result.failFast).toBe(true);
    });

    test('maps --force-exit to forceExit', () => {
        const result = cliOptions(['node', 'script', '--force-exit']);
        expect(result.forceExit).toBe(true);
    });

    test('maps multiple --tags to array', () => {
        const result = cliOptions(['node', 'script', '--tags', '@smoke', '--tags', '@regression']);
        expect(result.tags).toEqual(['@smoke', '@regression']);
    });

    test('maps --format-options to formatOptions', () => {
        const result = cliOptions(['node', 'script', '--format-options', '{"colorsEnabled":true}']);
        expect(result.formatOptions).toEqual(['{"colorsEnabled":true}']);
    });

    test('collects multiple --world-parameters', () => {
        const result = cliOptions(['node', 'script', '--world-parameters', '{"a":1}', '--world-parameters', '{"b":2}']);
        expect(result.worldParameters).toEqual(['{"a":1}', '{"b":2}']);
    });

    test.each(['abc', '-1', '1.5', ''])('throws for invalid --parallel %j', (value) => {
        expect(() => cliOptions(['node', 'script', '--parallel', value])).toThrow('--parallel must be a non-negative integer');
    });

    test('throws for invalid --retry', () => {
        expect(() => cliOptions(['node', 'script', '--retry', 'two'])).toThrow("--retry must be a non-negative integer, got 'two'");
    });

    test('positional feature paths are added to paths', () => {
        const result = cliOptions(['node', 'script', 'run', 'features/a.feature:12', '--paths', 'b.feature', 'c.feature']);
        expect(result.paths).toEqual(['b.feature', 'features/a.feature:12', 'c.feature']);
    });

    test('positionals that are not feature paths are ignored', () => {
        const result = cliOptions(['node', 'script', 'run', '--qavaValue', '42']);
        expect(result.paths).toBeUndefined();
    });

    test('maps --quiet and -q', () => {
        expect(cliOptions(['node', 'script', '--quiet']).quiet).toBe(true);
        expect(cliOptions(['node', 'script', '-q']).quiet).toBe(true);
    });
});

describe('findTypos', () => {
    test('suggests closest known option', () => {
        expect(findTypos(['--tag', '@one', '--profle=x', '--dryrun'])).toEqual([
            { flag: '--tag', suggestion: '--tags' },
            { flag: '--profle', suggestion: '--profile' },
            { flag: '--dryrun', suggestion: '--dry-run' },
        ]);
    });

    test('ignores known options, ui options and custom params', () => {
        expect(findTypos(['--tags', '@a', '--port', '1', '--no-open', '--qavaBoolean', '--qavaValue', '42', '--env'])).toEqual([]);
    });

    test('stops at --', () => {
        expect(findTypos(['--', '--tag'])).toEqual([]);
    });
});
