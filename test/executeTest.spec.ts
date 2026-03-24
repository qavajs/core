import { describe, expect, test, vi } from 'vitest';
import { DataTable } from '@cucumber/cucumber';
import { executeTest } from '../src/executeTest';

describe('executeTest', () => {
  test('executes steps for a scenario by title', async () => {
    const executeStep = vi.fn().mockResolvedValue(undefined);
    const world = { executeStep };

    await executeTest.call(world as any, 'test/fixtures/feature.feature', 'Login');

    expect(executeStep).toHaveBeenNthCalledWith(1, 'first step', undefined);
    expect(executeStep).toHaveBeenNthCalledWith(2, 'second step', undefined);
    expect(executeStep).toHaveBeenCalledTimes(2);
  });

  test('passes DataTable and doc string arguments to world.executeStep', async () => {
    const executeStep = vi.fn().mockResolvedValue(undefined);
    const world = { executeStep };

    await executeTest.call(world as any, 'test/fixtures/feature.feature', 'With table and doc string');

    expect(executeStep.mock.calls[0][0]).toEqual('table step');
    expect(executeStep.mock.calls[0][1]).toBeInstanceOf(DataTable);
    expect(executeStep.mock.calls[1]).toEqual(['doc step', 'payload']);
  });

  test('throws when scenario is not found', async () => {
    const world = { executeStep: vi.fn() };
    await expect(executeTest.call(world as any, 'test/fixtures/feature.feature', 'Unknown')).rejects.toThrow(
      /Scenario 'Unknown' not found/
    );
  });
});
