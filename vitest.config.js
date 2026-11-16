import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // src/index.ts only calls cli main(), covered by test/cli.spec.ts
      exclude: ['src/index.ts', '**/*.d.ts'],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 85,
        lines: 90,
      },
    },
    testTimeout: 20000
  }
})
