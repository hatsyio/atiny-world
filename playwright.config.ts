import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: process.env.VISUAL_BASE_URL ?? 'http://127.0.0.1:8770', browserName: 'chromium', trace: 'retain-on-failure' },
  snapshotPathTemplate: '{testDir}/snapshots/{platform}/{arg}{ext}',
  webServer: process.env.VISUAL_BASE_URL ? undefined : { command: 'node scripts/visual-select-server.mjs', url: 'http://127.0.0.1:8770', reuseExistingServer: !process.env.CI },
})
