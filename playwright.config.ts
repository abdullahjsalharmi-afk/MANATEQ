import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the single-file build (no server needed):
 *   npm run build:single && npm run e2e
 * Set MQ_APP_FILE to test a build in another folder.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    trace: 'off',
  },
});
