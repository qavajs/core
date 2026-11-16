import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pkg from '../package.json';

const root = resolve(__dirname, '..');
// self-reference by package name works only from inside the package scope (repo root package.json)
const rootRequire = createRequire(join(root, 'package.json'));

describe('package exports', () => {
    test.each([
        ['@qavajs/core', 'index.js'],
        ['@qavajs/core/utils', 'utils.js'],
        ['@qavajs/core/package.json', 'package.json'],
    ])('%s resolves to %s', (specifier, file) => {
        expect(rootRequire.resolve(specifier)).toBe(join(root, file));
    });

    test('internal files are not exposed', () => {
        expect(() => rootRequire.resolve('@qavajs/core/lib/run.js')).toThrow(/not defined by "exports"/);
    });

    test('every export target and types file exists and is published', () => {
        const targets = Object.values(pkg.exports).flatMap(target => typeof target === 'string' ? [target] : Object.values(target));
        for (const target of [...targets, pkg.main, pkg.module, pkg.types]) {
            expect(existsSync(join(root, target)), target).toBe(true);
            const file = target.replace('./', '');
            if (file !== 'package.json') expect(pkg.files, file).toContain(file);
        }
    });
});
