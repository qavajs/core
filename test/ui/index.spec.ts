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
