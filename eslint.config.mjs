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
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/components/ui/app-select.tsx'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'JSXOpeningElement[name.name="select"]',
        message: 'Usa AppSelect para compartir el menú, la flecha y la accesibilidad de los desplegables.',
      }],
      'no-restricted-imports': ['error', {
        paths: [{ name: 'react-aria-components', importNames: ['Select'], message: 'Usa AppSelect; las variantes se definen en el componente común.' }],
      }],
    },
  },
  globalIgnores([
    '.next/**',
    '.visual-test-build/**',
    'test-results/**',
    'playwright-report/**',
    '.worktrees/**',
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
  ]),
])
