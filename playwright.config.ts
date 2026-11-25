import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3101',
    headless: true,
  },
  webServer: {
    command: 'node server/index.js',
    url: 'http://localhost:3101/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '3101',
      DB_PATH: './data/test-informatika.db',
      RESET_DB_ON_START: '1',
    },
  },
});
