import { defineConfig, devices } from '@playwright/test';

// Smoke tests against a running stack (see scripts/smoke.mjs, `npm run test:smoke`).
const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8080';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
