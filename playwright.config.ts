import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Load monorepo root .env into process.env so webServer inherits them.
const envFile = path.resolve(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

// On macOS, localhost resolves to ::1 (IPv6) but docker binds to 127.0.0.1.
// Rewrite redis/db URLs that use localhost to 127.0.0.1.
function fixLocalhost(url: string): string {
  return url.replace('://localhost:', '://127.0.0.1:');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3011',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @earthropy/app dev',
    url: 'http://localhost:3011/en',
    reuseExistingServer: false,
    env: {
      APP_PORT: '3011',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3011',
      DATABASE_URL: fixLocalhost(process.env.DATABASE_URL ?? 'postgres://earthropy:earthropy@127.0.0.1:5434/earthropy'),
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'dev-test-secret-replace-in-prod-32-bytes-min',
      // Redis is atlas-redis on 127.0.0.1:6379 (macOS localhost → ::1 so must use 127.0.0.1)
      REDIS_URL: 'redis://127.0.0.1:6379',
      AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN ?? '',
      SMTP_HOST: fixLocalhost(process.env.SMTP_HOST ?? 'localhost'),
      SMTP_PORT: process.env.SMTP_PORT ?? '1025',
      SMTP_USER: process.env.SMTP_USER ?? '',
      SMTP_PASS: process.env.SMTP_PASS ?? '',
      SMTP_FROM: process.env.SMTP_FROM ?? 'Earthropy <noreply@earthropy.local>',
      NODE_ENV: 'development',
    },
    timeout: 120_000,
  },
});
