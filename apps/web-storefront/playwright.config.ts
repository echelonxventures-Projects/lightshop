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
      command: 'node ../../libs/testing/dist/mock-oidc-cli.js',
      url: 'http://localhost:4400/.well-known/openid-configuration',
      env: { MOCK_OIDC_PORT: '4400' },
      reuseExistingServer: false,
    },
    {
      command: 'node ../../services/catalog/dist/main.js',
      url: 'http://localhost:4101/health',
      env: {
        CATALOG_PORT: '4101',
        CATALOG_DATABASE_URL: '',
        SEED_DEMO: 'true',
        GATEWAY_SHARED_SECRET: 'e2e-gateway-secret',
        // Same identity provider as the storefront, as in production.
        OIDC_ISSUER: 'http://localhost:4400',
        OIDC_JWKS_URL: 'http://localhost:4400/jwks',
      },
      reuseExistingServer: false,
    },
    {
      command: 'pnpm exec next start -p 3100',
      url: 'http://localhost:3100',
      env: {
        API_URL: 'http://localhost:4101/graphql',
        GATEWAY_SHARED_SECRET: 'e2e-gateway-secret',
        OIDC_ISSUER: 'http://localhost:4400',
        OIDC_CLIENT_ID: 'lightshop-storefront',
        OIDC_CLIENT_SECRET: 'mock-secret',
        SESSION_SECRET: 'e2e-session-secret-0123456789abcdef',
      },
      reuseExistingServer: false,
    },
  ],
});
