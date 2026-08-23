import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'https://ranking-rho-three.vercel.app'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/production-readonly-ux.spec.mjs',
  timeout: 60_000,
  expect: {
    timeout: 12_000,
  },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-compat-report', open: 'never' }],
  ],
  use: {
    baseURL,
    extraHTTPHeaders: {
      'x-rankingwiki-production-e2e': 'readonly-v1',
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    navigationTimeout: 35_000,
    actionTimeout: 12_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop-firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'desktop-webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'] },
    },
  ],
})
