#!/usr/bin/env node
import { startMockOidcProvider } from './mock-oidc';

/** For Playwright/local runs: MOCK_OIDC_PORT=4400 lightshop-mock-oidc (demo users per tenant). */
void (async () => {
  const provider = await startMockOidcProvider({
    port: Number(process.env.MOCK_OIDC_PORT ?? 4400),
    clientSecret: process.env.MOCK_OIDC_CLIENT_SECRET ?? 'mock-secret',
    users: {
      'ana@acme': { sub: 'usr_ana', name: 'Ana Shopper', email: 'ana@acme.example', tenant_id: 'acme-mart', roles: ['buyer'] },
      'raj@verde': { sub: 'usr_raj', name: 'Raj Buyer', email: 'raj@verde.example', tenant_id: 'verde-wholesale', roles: ['buyer'], org_id: 'org_raj_traders' },
    },
  });
  console.log(`mock OIDC provider at ${provider.issuer}`);
})();
