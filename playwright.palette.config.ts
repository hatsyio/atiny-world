import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  testMatch: 'map-palette.spec.ts',
  outputDir: './test-results/map-palette',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8771', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node --env-file-if-exists=.env scripts/visual-map-server.mjs',
    url: 'http://127.0.0.1:8771', reuseExistingServer: false,
  },
})
