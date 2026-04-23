import { describe, expect, test, vi } from 'vitest';

const beforeAllSpy = vi.fn();
const afterAllSpy = vi.fn();

vi.mock('@cucumber/cucumber', () => ({
  BeforeAll: beforeAllSpy,
  AfterAll: afterAllSpy,
}));

describe('executionHooks', () => {
  test('registers hooks only for coordinator process', async () => {
    const hooks = await import('../src/executionHooks');
    const beforeFn = vi.fn();
    const afterFn = vi.fn();

    process.env.QAVAJS_COORDINATOR = '1';
    hooks.BeforeExecution(beforeFn as any);
    hooks.AfterExecution(afterFn as any);

    expect((beforeFn as any).isTestExecutionHook).toBe(true);
    expect((afterFn as any).isTestExecutionHook).toBe(true);
    expect(beforeAllSpy).toHaveBeenCalledWith(beforeFn);
    expect(afterAllSpy).toHaveBeenCalledWith(afterFn);
  });

  test('does not register hooks for worker process', async () => {
    const hooks = await import('../src/executionHooks');
    const beforeFn = vi.fn();

    process.env.QAVAJS_COORDINATOR = '0';
    hooks.BeforeExecution(beforeFn as any);

    expect((beforeFn as any).isTestExecutionHook).toBeUndefined();
  });
});
