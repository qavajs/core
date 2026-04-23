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
});
