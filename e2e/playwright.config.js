import { defineConfig, devices } from '@playwright/test';
import { API_URL, WEB_PORT, WEB_URL, serverEnv } from './env.js';

// Locally the tests drive the Chrome you already have installed, so there is no
// browser to download. CI installs Playwright's own Chromium instead.
const browser = process.env.CI ? {} : { channel: 'chrome' };

export default defineConfig({
  testDir: './tests',
  // One worker: the tests share one database and change who may sign in.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], ...browser } }],
  webServer: [
    {
      // The real API, on its own port and database (see env.js).
      command: 'node server.js',
      cwd: '../server',
      url: `${API_URL}/health`,
      env: serverEnv(),
      timeout: 90_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // The real web app, as a production build pointed at that API. A build is
      // served instantly, where the dev server compiles every page on first
      // visit, which is slow enough on a small machine to time tests out. It goes
      // to its own folder so a normal build in client/dist is left alone.
      command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${WEB_PORT} --strictPort`,
      cwd: '../client',
      url: WEB_URL,
      env: { VITE_API_BASE_URL: API_URL },
      timeout: 300_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
