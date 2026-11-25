import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:3197',
    channel: process.env.CAREBRIDGE_BROWSER || undefined,
    launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
  },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3197',
    env: { PORT: '3197', NODE_ENV: 'production', CAREBRIDGE_DISABLE_DEMO_TRANSLATION: '1', GEMINI_API_KEY: '' },
  },
});
