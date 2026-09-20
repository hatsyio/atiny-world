import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const coverageConfig = {
  provider: 'v8' as const,
  reporter: ['text', 'json-summary', 'lcov'],
  thresholds: {
    // Current project baseline; raise these as the pending flows gain tests.
    branches: 65,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    coverage: {
      ...coverageConfig,
      exclude: [
        'src/app/api/**/route.ts',
        'src/app/**/actions.ts',
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/**/index.ts',
        'src/proxy.ts',
      ],
      include: ['src/**/*.{ts,tsx}'],
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/support/jest-dom.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/support/test-env.ts'],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        test: {
          name: 'contract',
          environment: 'node',
          include: ['tests/contract/**/*.test.ts'],
          setupFiles: ['tests/support/test-env.ts'],
          testTimeout: 20_000,
        },
      },
    ],
  },
})
