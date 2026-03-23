import { describe, expect, test, vi } from 'vitest';
import ServiceHandler from '../src/ServiceHandler';

describe('ServiceHandler', () => {
  test('runs before and after hooks for object services', async () => {
    const before1 = vi.fn().mockResolvedValue(undefined);
    const after1 = vi.fn().mockResolvedValue(undefined);
    const before2 = vi.fn().mockResolvedValue(undefined);

    const handler = new ServiceHandler({
      service: [
        { before: before1, after: after1 },
        { before: before2 },
      ],
    } as any);

    await handler.before();
    await handler.after({ success: true } as any);

    expect(before1).toHaveBeenCalledTimes(1);
    expect(before2).toHaveBeenCalledTimes(1);
    expect(after1).toHaveBeenCalledWith({ success: true });
  });

  test('handles missing service list', async () => {
    const handler = new ServiceHandler({} as any);
    await expect(handler.before()).resolves.toBeUndefined();
    await expect(handler.after({ success: true } as any)).resolves.toBeUndefined();
  });
});
