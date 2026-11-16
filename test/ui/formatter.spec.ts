import { afterEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import UiFormatter from '../../src/ui/formatter';

const originalSend = process.send;

afterEach(() => {
    process.send = originalSend;
});

test('forwards every envelope to the parent process', () => {
    process.send = vi.fn() as any;
    const eventBroadcaster = new EventEmitter();
    new UiFormatter({ eventBroadcaster, parsedArgvOptions: {} } as any);
    const envelope = { testRunStarted: { timestamp: { seconds: 1, nanos: 0 } } };
    eventBroadcaster.emit('envelope', envelope);
    expect(process.send).toHaveBeenCalledWith({ type: 'envelope', envelope });
});

test('does nothing outside of a child process', () => {
    process.send = undefined;
    const eventBroadcaster = new EventEmitter();
    new UiFormatter({ eventBroadcaster, parsedArgvOptions: {} } as any);
    expect(() => eventBroadcaster.emit('envelope', {})).not.toThrow();
});
