/**
 * Real-browser test lane (#214). Kept apart from `bun test` so the fast lane
 * stays fast: run with `bun run test:browser` after `bun run build`.
 */

import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 4173);
/** Port of the full-stack example; `fullstack.pw.ts` reads it too. */
export const examplePort = Number(process.env.EXAMPLE_PORT ?? 4174);
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
  webServer: [
    {
      command: 'bun browser/server.ts',
      cwd: '..',
      url: `http://127.0.0.1:${port}/fixtures/blank.html`,
      reuseExistingServer: !process.env.CI,
      env: { PORT: String(port) },
    },
    {
      // The full-stack example (#226) doubles as an end-to-end target.
      command: 'bun examples/fullstack/server.ts',
      cwd: '..',
      url: `http://127.0.0.1:${examplePort}/login`,
      reuseExistingServer: !process.env.CI,
      env: { PORT: String(examplePort), SESSION_SECRET: 'browser-lane-secret-0123456789abcdef' },
    },
  ],
});
