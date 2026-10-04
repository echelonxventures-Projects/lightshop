import { defineConfig } from '@playwright/test';

/** Runs against the production-like local stack (pnpm local:up). Nothing is started here. */
export default defineConfig({
  testDir: './e2e-stack',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['line']],
  use: { trace: 'retain-on-failure' },
});
