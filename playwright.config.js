import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 4,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/alert/',
    browserName: 'chromium',
    channel: process.env.PW_CHANNEL || (process.env.CI ? 'chromium' : 'msedge'),
    viewport: { width: 390, height: 844 },
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort --base=/alert/',
    url: 'http://127.0.0.1:4173/alert/',
    reuseExistingServer: !process.env.CI,
    env: { VITE_SITE_URL: 'http://127.0.0.1:4173/alert' },
  },
})
