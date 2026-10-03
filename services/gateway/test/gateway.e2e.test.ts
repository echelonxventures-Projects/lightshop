import { GATEWAY_TOKEN_HEADER } from '@lightshop/auth';
import { MockOidcProvider, eventually, freePort, startMockOidcProvider } from '@lightshop/testing';
import { ChildProcess, spawn } from 'node:child_process';
import { request } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { RunningGateway, startGateway } from '../src/gateway';

const ROOT = join(__dirname, '../../..');
const SECRET = 'gateway-e2e-shared-secret-0123456789';
let idp: MockOidcProvider;
let catalog: ChildProcess;
let gateway: RunningGateway;

const users = {
  acmeAdmin: { sub: 'usr_admin', tenant_id: 'acme-mart', roles: ['catalog:admin'] },
  verdeAdmin: { sub: 'usr_verde', tenant_id: 'verde-wholesale', roles: ['catalog:admin'] },
};

beforeAll(async () => {
  idp = await startMockOidcProvider({ users });
  const catalogPort = await freePort();
  const oidc = { OIDC_ISSUER: idp.issuer, OIDC_JWKS_URL: `${idp.issuer}/jwks` };
  catalog = spawn('node', [join(ROOT, 'services/catalog/dist/main.js')], {
    env: { ...process.env, ...oidc, CATALOG_PORT: String(catalogPort), CATALOG_DATABASE_URL: '', SEED_DEMO: 'true', GATEWAY_SHARED_SECRET: SECRET, OTEL_SDK_DISABLED: 'true' },
    stdio: 'ignore',
  });
  await eventually(async () => ((await fetch(`http://localhost:${catalogPort}/health`).catch(() => undefined))?.ok ? true : undefined), 20_000);

  gateway = await startGateway(
    {
      ...loadConfig({ ...oidc, GATEWAY_SHARED_SECRET: SECRET, SUBGRAPHS: `catalog=http://localhost:${catalogPort}/graphql` }),
      port: 0,
      rateLimitPerMinute: 30,
      maxDepth: 5,
    },
    () => undefined,
  );
}, 60_000);

afterAll(async () => {
  await gateway?.close();
  catalog?.kill();
  await idp?.close();
});

type Reply = { status: number; headers: Record<string, string | string[] | undefined>; body: { data?: any; errors?: Array<{ message: string; extensions?: { code?: string } }> } };

/** node:http (not fetch): fetch silently drops a custom Host header, and Host is what selects the store. */
function call(method: string, headers: Record<string, string>, payload?: string): Promise<Reply> {
  const { port } = new URL(gateway.url);
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/graphql', method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data ? JSON.parse(data) : {} }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

const gql = (query: string, headers: Record<string, string> = {}, variables: Record<string, unknown> = {}) =>
  call('POST', { 'content-type': 'application/json', host: 'acme.localhost', ...headers }, JSON.stringify({ query, variables }));

describe('gateway', () => {
  it('serves the composed graph for the tenant resolved from Host', async () => {
    const r = await gql(`{ products { edges { node { id title } } } }`);
    expect(r.status).toBe(200);
    expect(r.body.data.products.edges.map((e: any) => e.node.id)).toContain('prd_demo_phone');
    const verde = await gql(`{ products { edges { node { id } } } }`, { host: 'verde.localhost' });
    expect(verde.body.data.products.edges.map((e: any) => e.node.id)).toContain('prd_demo_bolts');
  });

  it('returns 404 for unknown hosts', async () => {
    const r = await gql(`{ __typename }`, { host: 'nobody.example' });
    expect(r.status).toBe(404);
    expect(r.body.errors?.[0]?.extensions?.code).toBe('TENANT_NOT_FOUND');
  });

  it('strips client-supplied identity headers (no tenant spoofing through the edge)', async () => {
    const r = await gql(`{ products { edges { node { id } } } }`, { 'x-tenant-id': 'verde-wholesale', [GATEWAY_TOKEN_HEADER]: 'guess' });
    const ids = r.body.data.products.edges.map((e: any) => e.node.id);
    expect(ids).toContain('prd_demo_phone');
    expect(ids).not.toContain('prd_demo_bolts');
  });

  it('lets a trusted BFF select the tenant explicitly', async () => {
    const r = await gql(`{ products { edges { node { id } } } }`, { host: 'internal', 'x-tenant-id': 'verde-wholesale', [GATEWAY_TOKEN_HEADER]: SECRET });
    expect(r.body.data.products.edges.map((e: any) => e.node.id)).toContain('prd_demo_bolts');
  });

  it('verifies tokens at the edge and forwards them for writes', async () => {
    expect((await gql(`{ __typename }`, { authorization: 'Bearer junk' })).status).toBe(401);
    const verde = await idp.accessToken(users.verdeAdmin);
    const wrong = await gql(`{ __typename }`, { authorization: `Bearer ${verde}` });
    expect(wrong.status).toBe(403);

    const admin = await idp.accessToken(users.acmeAdmin);
    const created = await gql(
      `mutation($i: CreateProductInput!) { createProduct(input: $i) { id title } }`,
      { authorization: `Bearer ${admin}` },
      { i: { vertical: 'electronics', titles: { en: 'Gateway Earbuds' }, categoryPath: [], attributes: { brand: 'Volt', model: 'G1', warrantyMonths: 12 } } },
    );
    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.createProduct.title).toBe('Gateway Earbuds');

    const anon = await gql(`mutation { createProduct(input: { vertical: "electronics", titles: { en: "X" }, categoryPath: [], attributes: { brand: "K", model: "M", warrantyMonths: 1 } }) { id } }`);
    expect(anon.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('enforces query depth at the edge', async () => {
    const r = await gql(`{ products { edges { node { offers { price { amount } } } } } }`);
    expect(r.body.errors?.[0]?.extensions?.code).toBe('QUERY_TOO_DEEP');
  });

  it('allows CORS only from the tenant\'s own domains', async () => {
    const ok = await call('OPTIONS', { host: 'acme.localhost', origin: 'http://acme.localhost:5678' });
    expect(ok.status).toBe(204);
    expect(ok.headers['access-control-allow-origin']).toBe('http://acme.localhost:5678');
    const evil = await call('OPTIONS', { host: 'acme.localhost', origin: 'https://evil.example' });
    expect(evil.status).toBe(403);
  });

  it('rate-limits per tenant and client', async () => {
    let limited: Reply | undefined;
    for (let i = 0; i < 40 && !limited; i++) {
      const r = await gql(`{ __typename }`, { host: 'verde.localhost' });
      if (r.status === 429) limited = r;
    }
    expect(limited?.body.errors?.[0]?.extensions?.code).toBe('RATE_LIMITED');
    expect(Number(limited?.headers['retry-after'])).toBeGreaterThan(0);
  });
});
