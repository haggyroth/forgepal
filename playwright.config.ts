import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests, run against a production build.
 *
 * The unit and component suite is strong and covers each module in isolation.
 * What it cannot see is composition and the *built artifact* — which is exactly
 * where this project's known deploy failures live: `base` resolving wrongly so
 * every asset 404s, and a lazy chunk hash that no longer exists.
 *
 * Hence `GITHUB_ACTIONS=1` in the build below. `vite.config.ts` reads that to
 * set `base` to `/forgepal/`, so these tests exercise the same subpath
 * production serves. Testing against `npm run dev` at `/` would pass while the
 * deployed site was broken, which is the failure mode worth catching.
 */
const PORT = 4173
const BASE_PATH = '/forgepal/'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
  },

  // Chromium only. This suite exists to check composition and the production
  // path, not cross-browser rendering — three engines would triple CI time for
  // coverage the unit suite already provides differently.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // GITHUB_ACTIONS=1 on *both* halves, not just the build. vite.config.ts reads
    // it at config load to pick `base`, so setting it only for the build produced
    // a dist referencing /forgepal/… served by a preview rooted at / — and vite's
    // SPA fallback then answered every asset request with index.html at HTTP 200
    // and Content-Type: text/html. The module never executed, the page stayed
    // blank, and nothing returned an error status. Exactly the failure this suite
    // is here to catch, found while writing it.
    command:
      'GITHUB_ACTIONS=1 npm run build && GITHUB_ACTIONS=1 npm run preview -- --port 4173 --strictPort',
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
