import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    // firefox and webkit require additional system deps — install via: npx playwright install-deps
  ],
  webServer: {
    command: 'npx live-server dist --port=3100 --no-browser --quiet',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000
  }
});
