import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const hasSystemChrome =
  process.platform === 'darwin' &&
  existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    ...(hasSystemChrome ? { channel: 'chrome' as const } : {}),
    headless: true,
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: {
    command: 'node scripts/static-server.mjs',
    url: 'http://127.0.0.1:4173/examples/sample-note.html',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
