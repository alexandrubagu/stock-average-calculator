import { defineConfig, devices } from '@playwright/test'
import { resolveSiteConfig } from './site.config.ts'

// End-to-end tests run against the production build (`npm run build` first),
// served by `vite preview` under the same base path as GitHub Pages.
const PORT = 4173
const { basePath } = resolveSiteConfig()
const baseURL = `http://localhost:${PORT}${basePath}`

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
