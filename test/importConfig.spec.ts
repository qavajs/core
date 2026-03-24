import { describe, expect, test } from 'vitest';
import { importConfig, importMemory } from '../src/importConfig';

describe('importConfig', () => {
  test('loads named profile from ESM config default export', async () => {
    const config = await importConfig('test/fixtures/config-with-profiles.mjs', 'one');
    expect(config).toEqual({ value: 1 });
  });

  test('loads default profile from ESM config default export', async () => {
    const config = await importConfig('test/fixtures/config-with-profiles.mjs', 'default');
    expect(config).toEqual({ value: 'default-profile' });
  });

  test('loads named profile from CJS config export', async () => {
    const config = await importConfig('test/fixtures/config-with-profiles.js', 'one');
    expect(config).toEqual({ value: 1 });
  });

  test('falls back to plain config object for default profile', async () => {
    const config = await importConfig('test/fixtures/config-plain.js', 'default');
    expect(config).toEqual({ value: 'plain-config' });
  });

  test('throws for missing profile', async () => {
    await expect(importConfig('test/fixtures/config-with-profiles.mjs', 'missing')).rejects.toThrow(
      "profile 'missing' is not defined"
    );
  });
});

describe('importMemory', () => {
  test('returns memory instance from module', async () => {
    const memoryInstance = await importMemory('test/fixtures/memory-module.js');
    expect(memoryInstance).toEqual({ token: 'memory-token' });
  });
});
