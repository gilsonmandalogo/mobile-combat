import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4321',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'yarn dev --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321/mobile-combat/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
