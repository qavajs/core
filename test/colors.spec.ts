import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { painter, useColors } from '../src/colors';

describe('colors', () => {
    let env: NodeJS.ProcessEnv;

    beforeEach(() => {
        env = { ...process.env };
        delete process.env.FORCE_COLOR;
        delete process.env.NO_COLOR;
    });

    afterEach(() => {
        process.env = env;
    });

    test('colors follow tty of the stream', () => {
        expect(useColors({ isTTY: true })).toBe(true);
        expect(useColors({ isTTY: false })).toBe(false);
    });

    test('NO_COLOR disables and FORCE_COLOR enables colors', () => {
        process.env.NO_COLOR = '1';
        expect(useColors({ isTTY: true })).toBe(false);
        process.env.FORCE_COLOR = '1';
        expect(useColors({ isTTY: false })).toBe(true);
        process.env.FORCE_COLOR = '0';
        expect(useColors({ isTTY: true })).toBe(false);
    });

    test('painter wraps text in ansi codes only when colors are enabled', () => {
        expect(painter({ isTTY: true })('error:', 'bold', 'red')).toBe('\x1b[1m\x1b[31merror:\x1b[0m');
        expect(painter({ isTTY: true })('plain')).toBe('plain');
        expect(painter({ isTTY: false })('error:', 'red')).toBe('error:');
    });
});
