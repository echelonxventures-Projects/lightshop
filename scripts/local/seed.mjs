// Loads config/demo/catalog.json into the production-like stack THROUGH THE PUBLIC API:
// real IdP tokens (one admin per store), real authorization, validation, events. Idempotent.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createLightshopClient, LightshopApiError } = require('../../libs/api-sdk/dist/index.js');

const env = (name, fallback) => process.env[name] ?? fallback ?? (() => { throw new Error(`${name} is required`); })();
const API_URL = env('API_URL');
const TOKEN_URL = env('TOKEN_URL');
const GATEWAY_SECRET = env('GATEWAY_SHARED_SECRET');
const CLIENT_ID = env('SEED_CLIENT_ID', 'lightshop-ci');
const CLIENT_SECRET = env('SEED_CLIENT_SECRET', 'ci-secret');
// Store → admin account in the IdP (dev realm: password = username).
const ADMINS = JSON.parse(env('SEED_ADMINS', '{"acme-mart":"acme-admin","verde-wholesale":"verde-admin"}'));

const demo = JSON.parse(readFileSync(new URL('../../config/demo/catalog.json', import.meta.url), 'utf8')).tenants;

async function token(username) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, username, password: username, scope: 'openid' }),
  });
  if (!res.ok) throw new Error(`token for ${username}: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** Tenants reach the catalog via the registry within a few seconds of startup: retry until they do. */
async function retry(fn, what) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const transient = err instanceof LightshopApiError ? ['TENANT_NOT_FOUND', 'BAD_RESPONSE'].includes(err.code) : true;
      if (!transient || attempt >= 30) throw err;
      console.log(`  waiting for ${what} (${err.message})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

let created = 0;
for (const [tenantId, products] of Object.entries(demo)) {
  const admin = ADMINS[tenantId];
  if (!admin) {
    console.log(`skip ${tenantId}: no admin configured`);
    continue;
  }
  const accessToken = await token(admin);
  const client = createLightshopClient({ endpoint: API_URL, tenantId, gatewaySecret: GATEWAY_SECRET, getToken: () => accessToken });
  const existing = await retry(() => client.products({ first: 1 }), `${tenantId} catalog`);
  if (existing.items.length > 0) {
    console.log(`${tenantId}: already seeded`);
    continue;
  }
  for (const { id: _demoId, offers, ...product } of products) {
    const p = await client.createProduct(product);
    for (const offer of offers) await client.addOffer(p.id, offer);
    created++;
    console.log(`${tenantId}: ${p.title} (${offers.length} offer${offers.length === 1 ? '' : 's'})`);
  }
}
console.log(`seed complete: ${created} product(s) created`);
