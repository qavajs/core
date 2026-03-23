import { describe, expect, test, vi } from 'vitest';

const { defineStep, stepDefinitionConfigs } = vi.hoisted(() => ({
  defineStep: vi.fn(),
  stepDefinitionConfigs: [{ pattern: 'I do test' }, { pattern: 'I do other' }],
}));

vi.mock('@cucumber/cucumber', () => ({
  defineStep,
  supportCodeLibraryBuilder: {
    stepDefinitionConfigs,
  },
}));

import { Override } from '../src/Override';

describe('Override', () => {
  test('replaces previous step definition and defines new one', () => {
    const impl = vi.fn();

    Override('I do test', impl);

    expect(stepDefinitionConfigs.find(def => def.pattern === 'I do test')).toBeUndefined();
    expect(defineStep).toHaveBeenCalledWith('I do test', impl);
  });
});
