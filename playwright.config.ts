import { defineConfig, devices } from '@playwright/test'

const url = `http://localhost:4173${process.env.BASE_PATH ?? '/ajedrez/'}`

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: url },
  webServer: {
    command: 'npm run build && npm run preview',
    url,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'movil', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
})
