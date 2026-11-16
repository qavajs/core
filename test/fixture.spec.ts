import { describe, expect, test, vi } from 'vitest';

const { beforeSpy, afterSpy } = vi.hoisted(() => ({
  beforeSpy: vi.fn(),
  afterSpy: vi.fn(),
}));

vi.mock('@cucumber/cucumber', () => ({
  Before: beforeSpy,
  After: afterSpy,
}));

import { Fixture } from '../src/Fixture';

describe('Fixture', () => {
  test('registers setup and teardown hooks and executes teardown', async () => {
    const teardown = vi.fn().mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(teardown);

    Fixture({ name: 'sample', tags: '@smoke' }, setup as any);

    expect(beforeSpy).toHaveBeenCalledTimes(1);
    expect(afterSpy).toHaveBeenCalledTimes(1);

    const beforeHandler = beforeSpy.mock.calls[0][1];
    const afterHandler = afterSpy.mock.calls[0][1];
    const world: any = { token: 'w' };

    await beforeHandler.call(world);
    expect(world['__fixtureTearDown_sample']).toBe(teardown);
    await afterHandler.call(world);

    expect(setup).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  test('throws when fixture name is empty', () => {
    expect(() => Fixture({ name: '' }, vi.fn() as any)).toThrow('Fixture name is required');
  });

  test('skips teardown when setup was never called', async () => {
    const teardown = vi.fn();
    Fixture({ name: 'no-setup' }, vi.fn().mockResolvedValue(teardown) as any);

    const afterHandler = afterSpy.mock.calls[afterSpy.mock.calls.length - 1][1];
    const world: any = {};
    await afterHandler.call(world);
    expect(teardown).not.toHaveBeenCalled();
  });

  function lastHandlers() {
    return {
      setup: beforeSpy.mock.calls[beforeSpy.mock.calls.length - 1][1],
      teardown: afterSpy.mock.calls[afterSpy.mock.calls.length - 1][1],
    };
  }

  test('setup without teardown is allowed', async () => {
    Fixture({ name: 'no-teardown' }, vi.fn().mockResolvedValue(undefined));
    const { setup, teardown } = lastHandlers();
    const world: any = {};
    await setup.call(world);
    await expect(teardown.call(world)).resolves.toBeUndefined();
  });

  test('setup error names the fixture', async () => {
    Fixture({ name: 'db' }, vi.fn().mockRejectedValue(new Error('connection refused')));
    const { setup } = lastHandlers();
    await expect(setup.call({})).rejects.toThrow("Fixture 'db' setup failed, teardown will not run: connection refused");
  });

  test('non error thrown from setup is wrapped', async () => {
    Fixture({ name: 'str' }, vi.fn().mockRejectedValue('oops'));
    const { setup } = lastHandlers();
    await expect(setup.call({})).rejects.toThrow("Fixture 'str' setup failed, teardown will not run: oops");
  });

  test('setup returning a non function is rejected', async () => {
    Fixture({ name: 'bad' }, vi.fn().mockResolvedValue({ stop() {} }));
    const { setup } = lastHandlers();
    await expect(setup.call({})).rejects.toThrow("Fixture 'bad' setup must return a teardown function or nothing, got object");
  });

  test('teardown error names the fixture and teardown runs only once', async () => {
    const teardownFn = vi.fn().mockRejectedValue(new Error('still running'));
    Fixture({ name: 'server' }, vi.fn().mockResolvedValue(teardownFn));
    const { setup, teardown } = lastHandlers();
    const world: any = {};
    await setup.call(world);
    await expect(teardown.call(world)).rejects.toThrow("Fixture 'server' teardown failed: still running");
    await teardown.call(world);
    expect(teardownFn).toHaveBeenCalledTimes(1);
    expect(teardownFn.mock.contexts[0]).toBe(world);
  });
});

