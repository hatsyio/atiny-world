import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      quotes: ['error', 'single', { avoidEscape: true }],
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
  ]),
])
