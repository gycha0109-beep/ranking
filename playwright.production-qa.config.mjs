import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'https://ranking-rho-three.vercel.app'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: {
    timeout: 12_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-qa-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    navigationTimeout: 30_000,
    actionTimeout: 12_000,
  },
  projects: [
    {
      name: 'chromium-production-qa',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
