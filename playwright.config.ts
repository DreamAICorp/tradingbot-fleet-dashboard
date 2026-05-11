import { defineConfig, devices } from '@playwright/test';

// E2E harness — boots a REAL FastAPI on :8765 with a seeded paper_unified.db,
// then Next.js on :3100 with NEXT_PUBLIC_API_URL pointing at the harness.
// Playwright tests hit the dashboard exactly like a user would, going
// through the actual fleet REST endpoints. Zero fetch mocks per
// AI_CONTRIBUTING "fetch-mock ban" + memory feedback_e2e_real_user_journey.
//
// The harness file's path is computed relative to this config so CI works
// when checked out as a sibling repo of tradingbot-platform.

const HARNESS_PORT = 8765;
const HARNESS_URL = `http://127.0.0.1:${HARNESS_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Two-server orchestration — Playwright starts both, waits on both
  // before running tests, and SIGTERMs both at exit.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          // Real backend with seeded paper_unified.db
          command: `python -m tests.e2e.harness.seed_backend --port ${HARNESS_PORT} --fixture paired_bananausdt`,
          url: `${HARNESS_URL}/api/fleet/champions`,
          timeout: 30_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'npm run dev',
          port: 3100,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          env: { NEXT_PUBLIC_API_URL: HARNESS_URL },
        },
      ],
});
