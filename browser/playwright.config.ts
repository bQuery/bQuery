/**
 * Real-browser test lane (#214). Kept apart from `bun test` so the fast lane
 * stays fast: run with `bun run test:browser` after `bun run build`.
 */

import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 4173);
// Lets a sandbox with a preinstalled Chromium of another revision reuse it.
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: '.',
  testMatch: '*.pw.ts',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: './playwright-report' }]]
    : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : {},
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'bun browser/server.ts',
    cwd: '..',
    url: `http://127.0.0.1:${port}/fixtures/blank.html`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port) },
  },
});
