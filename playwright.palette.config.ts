import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  testMatch: ['map-palette.spec.ts', 'map-attribution.spec.ts'],
  outputDir: './test-results/map-palette',
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: process.env.PALETTE_BASE_URL ?? 'http://127.0.0.1:8771', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: process.env.PALETTE_BASE_URL ? undefined : {
    command: 'node --env-file-if-exists=.env scripts/visual-map-server.mjs',
    url: 'http://127.0.0.1:8771', reuseExistingServer: false,
  },
})
