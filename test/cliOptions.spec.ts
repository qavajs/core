import { describe, test, expect } from 'vitest';
import { cliOptions } from '../src/cliOptions';

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
        expect(result.formatOptions).toBe('{"colorsEnabled":true}');
    });
});
