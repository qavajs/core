import { describe, expect, test, vi } from 'vitest';
import { Template } from '../src/Template';

describe('Template', () => {
  test('expands scenario and executes each non-empty line', async () => {
    const executeStep = vi.fn().mockResolvedValue(undefined);
    const world = { executeStep };

    const stepImpl = Template((name: string) => `\n Given open ${name}\n\n And submit ${name} \n`);
    await (stepImpl as any).call(world, 'form');

    expect(executeStep).toHaveBeenNthCalledWith(1, 'Given open form');
    expect(executeStep).toHaveBeenNthCalledWith(2, 'And submit form');
    expect(executeStep).toHaveBeenCalledTimes(2);
  });
});
