import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: process.env.TEMP
    ? `${process.env.TEMP}/ostrze-playwright-results`
    : './.playwright-results',
  fullyParallel: false,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    headless: true,
    baseURL: 'http://127.0.0.1:4173'
  }
});
