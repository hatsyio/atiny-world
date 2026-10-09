import { defineConfig } from '@playwright/test'

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(databaseUrl).hostname)) throw new Error('Map browser tests require a local test database')

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results-map',
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3011', browserName: 'chromium', locale: 'en-US', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev --port 3011', url: 'http://localhost:3011/map', reuseExistingServer: false,
    env: { DATABASE_URL: databaseUrl, CURSOR_SECRET: 'local-map-browser-test-cursor-secret', NEXT_PUBLIC_CARTO_BASEMAP_KEY: 'local-map-browser-test-key' },
  },
})
