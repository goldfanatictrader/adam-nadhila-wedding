import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:4321',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'ASTRO_DEV_BACKGROUND= npm run dev -- --ignore-lock',
    url: 'http://localhost:4321/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
