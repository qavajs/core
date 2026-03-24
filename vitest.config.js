import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['/lib/', '/node_modules/', 'src/@types/**', '**/*.d.ts', 'src/load.ts'],
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
    },
    testTimeout: 20000
  }
})
