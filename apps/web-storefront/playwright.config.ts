import { defineConfig } from '@playwright/test';

/**
 * Smoke test: catalog subgraph (in-memory mode, zero dependencies) + production storefront build.
 * Two hostnames prove one deployment serves two differently branded tenants.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://acme.localhost:3100' },
  webServer: [
    {
      command: 'node ../../services/catalog/dist/main.js',
      url: 'http://localhost:4101/health',
      env: { CATALOG_PORT: '4101', CATALOG_DATABASE_URL: '' },
      reuseExistingServer: false,
    },
    {
      command: 'pnpm exec next start -p 3100',
      url: 'http://localhost:3100',
      env: { CATALOG_GRAPHQL_URL: 'http://localhost:4101/graphql' },
      reuseExistingServer: false,
    },
  ],
});
