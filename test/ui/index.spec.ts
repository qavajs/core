import { test, expect } from 'vitest';
import { parseUiArgs } from '../../src/ui';

test('parseUiArgs separates ui options from run options', () => {
    expect(parseUiArgs(['node', 'qavajs', 'ui', '--config', 'c.js', '--port', '3000', '--host=0.0.0.0', '--no-open', '--tags', '@a'])).toEqual({
        host: '0.0.0.0',
        port: 3000,
        open: false,
        passthrough: ['--config', 'c.js', '--tags', '@a']
    });
    expect(parseUiArgs(['node', 'qavajs', 'ui'])).toEqual({ host: 'localhost', port: 0, open: true, passthrough: [] });
    expect(() => parseUiArgs(['node', 'qavajs', 'ui', '--port', 'abc'])).toThrow('--port');
});

test('parseUiArgs reports invalid ui options as usage errors', async () => {
    const { UsageError } = await import('../../src/UsageError');
    const parse = (...args: string[]) => () => parseUiArgs(['node', 'qavajs', 'ui', ...args]);
    expect(parse('--port', 'abc')).toThrow(UsageError);
    expect(parse('--port', '70000')).toThrow('between 0 and 65535');
    expect(parse('--port', '-1')).toThrow('--port requires a value');
    expect(parse('--port')).toThrow('--port requires a value');
    expect(parse('--port', '--no-open')).toThrow('--port requires a value');
    expect(parse('--host')).toThrow('--host requires a value');
    expect(parse('--host=')).toThrow('--host must not be empty');
    expect(parseUiArgs(['node', 'qavajs', 'ui', '--port=0', '--open']).open).toBe(true);
});
