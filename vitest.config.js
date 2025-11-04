import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            include: ['src/run.ts', 'src/ServiceHandler.ts'],
            exclude: ["/lib/", "/node_modules/"],
            branches: 0,
            functions: 0,
            lines: 0,
            statements: -10,
        },
        testTimeout: 20000
    }
})
