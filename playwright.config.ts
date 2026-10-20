import { defineConfig } from '@playwright/test';

// End-to-end tests load the *built* unpacked extension (dist/world-time-ruler) into Chromium.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
});
