import 'reflect-metadata';
import { InMemoryEventBus } from '@lightshop/adapters';
import { GATEWAY_TOKEN_HEADER, mintDevToken } from '@lightshop/auth';
import { CatalogEventTypes } from '@lightshop/contracts';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogModule } from '../src/catalog.module';
import { loadConfig } from '../src/config';
import { OutboxRelay } from '@lightshop/outbox';
import { OUTBOX_RELAY } from '../src/tokens';

let app: INestApplication;
const bus = new InMemoryEventBus();
const DEV_SECRET = 'e2e-dev-secret-0123456789';
const GATEWAY_SECRET = 'e2e-gateway-secret';
const gateway = { [GATEWAY_TOKEN_HEADER]: GATEWAY_SECRET };
const acme = { ...gateway, 'x-tenant-id': 'acme-mart' };

const token = (claims: { tenant_id?: string; roles: string[]; seller_id?: string }) =>
  mintDevToken(DEV_SECRET, { sub: 'u_test', tenant_id: claims.tenant_id ?? 'acme-mart', roles: claims.roles, seller_id: claims.seller_id });
let adminToken: string;
const asAdmin = () => ({ ...acme, authorization: `Bearer ${adminToken}` });

type Gql = { data?: Record<string, any>; errors?: Array<{ message: string; extensions?: { code?: string; details?: string[] } }> };

async function gql(query: string, variables: Record<string, unknown> = {}, headers: Record<string, string> = acme): Promise<Gql> {
  const res = await request(app.getHttpServer()).post('/graphql').set(headers).send({ query, variables });
  return res.body as Gql;
}

beforeAll(async () => {
  const config = {
    ...loadConfig({ DEV_AUTH_SECRET: DEV_SECRET, GATEWAY_SHARED_SECRET: GATEWAY_SECRET, SEED_DEMO: 'true' }),
    databaseUrl: undefined,
    outboxIntervalMs: 60_000,
  };
  adminToken = await token({ roles: ['catalog:admin'] });
  const moduleRef = await Test.createTestingModule({ imports: [CatalogModule.forRoot(config, { eventBus: bus })] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('catalog subgraph', () => {
  it('lists seeded products for a tenant, localized', async () => {
    const r = await gql(`{ products { edges { node { id title vertical } } } }`, {}, { ...acme, 'accept-language': 'es-MX,es;q=0.9' });
    expect(r.errors).toBeUndefined();
    const titles = r.data!.products.edges.map((e: any) => e.node.title);
    expect(titles).toContain('Smartphone Nova X2 128 GB');
    expect(titles).toHaveLength(3);
  });

  it('picks the buy box across sellers and formats money per locale', async () => {
    const r = await gql(`{ product(id: "prd_demo_phone") { buyBox { sellerId price { amount currency formatted } } offers { sellerId } } }`);
    expect(r.data!.product.offers).toHaveLength(3);
    expect(r.data!.product.buyBox).toEqual({ sellerId: 'sel_gadgetco', price: { amount: '479.00', currency: 'USD', formatted: '$479.00' } });
  });

  it('resolves white-label tenants by Host and isolates their data', async () => {
    const r = await gql(`{ products { edges { node { id buyBox { moq price { formatted } } } } } product(id: "prd_demo_phone") { id } }`, {}, { host: 'verde.localhost:4001' });
    const ids = r.data!.products.edges.map((e: any) => e.node.id);
    expect(ids.sort()).toEqual(['prd_demo_bolts', 'prd_demo_polo']);
    expect(r.data!.product).toBeNull();
    const bolts = r.data!.products.edges.find((e: any) => e.node.id === 'prd_demo_bolts').node;
    expect(bolts.buyBox).toEqual({ moq: 25, price: { formatted: '₹2,390.00' } });
  });

  it('rejects unknown tenants', async () => {
    const r = await gql(`{ products { edges { cursor } } }`, {}, { host: 'nobody.example' });
    expect(r.errors?.[0]?.extensions?.code).toBe('TENANT_NOT_FOUND');
  });

  it('only exposes vertical packs the tenant enabled', async () => {
    const r = await gql(`{ verticalPacks { id name facets } }`, {}, { ...gateway, 'x-tenant-id': 'verde-wholesale' });
    expect(r.data!.verticalPacks.map((p: any) => p.id).sort()).toEqual(['fashion', 'industrial']);
  });

  const CREATE = `mutation($input: CreateProductInput!) { createProduct(input: $input) { id title attributes } }`;

  it('validates attributes against the vertical pack', async () => {
    const r = await gql(CREATE, { input: { vertical: 'electronics', titles: { en: 'Bad' }, categoryPath: [], attributes: { brand: 'X' } } }, asAdmin());
    expect(r.errors?.[0]?.extensions?.code).toBe('VALIDATION_FAILED');
    expect(r.errors?.[0]?.extensions?.details).toEqual(expect.arrayContaining([expect.stringMatching(/model/), expect.stringMatching(/warrantyMonths/)]));
  });

  it('blocks verticals the tenant has not enabled', async () => {
    const r = await gql(CREATE, { input: { vertical: 'pharmacy', titles: { en: 'Aspirin' }, categoryPath: [], attributes: {} } }, asAdmin());
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN_VERTICAL');
  });

  it('creates a product, adds an offer and publishes events through the outbox', async () => {
    const created = await gql(CREATE, {
      input: { vertical: 'electronics', titles: { en: 'Volt Earbuds' }, categoryPath: ['Audio'], attributes: { brand: 'Volt', model: 'E1', warrantyMonths: 6 } },
    }, asAdmin());
    expect(created.errors).toBeUndefined();
    const id = created.data!.createProduct.id as string;
    expect(id).toMatch(/^prd_/);
    expect(created.data!.createProduct.attributes.serialTracked).toBe(false);

    const badCurrency = await gql(`mutation { addOffer(productId: "${id}", input: { sellerId: "s1", sku: "E1", price: "10", currency: "INR", stock: 1 }) { id } }`, {}, asAdmin());
    expect(badCurrency.errors?.[0]?.extensions?.code).toBe('UNSUPPORTED_CURRENCY');

    const offered = await gql(`mutation { addOffer(productId: "${id}", input: { sellerId: "s1", sku: "E1", price: "59.99", currency: "USD", stock: 7 }) { buyBox { sku stock } } }`, {}, asAdmin());
    expect(offered.data!.addOffer.buyBox).toEqual({ sku: 'E1', stock: 7 });

    await app.get<OutboxRelay>(OUTBOX_RELAY).flush();
    const types = bus.published.filter((p) => p.event.aggregateId === id).map((p) => p.event.type);
    expect(types).toEqual([CatalogEventTypes.ProductCreated, CatalogEventTypes.OfferAdded]);
    expect(bus.published.every((p) => p.topic === 'catalog.product.v1')).toBe(true);
  });

  it('paginates with cursors', async () => {
    const first = await gql(`{ products(first: 2) { edges { cursor node { id } } pageInfo { hasNextPage endCursor } } }`);
    expect(first.data!.products.pageInfo.hasNextPage).toBe(true);
    const next = await gql(`query($after: String) { products(first: 10, after: $after) { edges { node { id } } pageInfo { hasNextPage } } }`, {
      after: first.data!.products.pageInfo.endCursor,
    });
    const seen = [...first.data!.products.edges, ...next.data!.products.edges].map((e: any) => e.node.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(next.data!.products.pageInfo.hasNextPage).toBe(false);
  });

  it('exposes health with outbox depth', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.body).toMatchObject({ status: 'ok', service: 'catalog' });
  });
});

describe('catalog security', () => {
  const OFFER = (sellerId: string) =>
    `mutation { addOffer(productId: "prd_demo_tee", input: { sellerId: "${sellerId}", sku: "SKU-${sellerId}", price: "17.00", currency: "USD", stock: 5 }) { id } }`;
  const CREATE_TEE = `mutation { createProduct(input: { vertical: "general", titles: { en: "Mug" }, categoryPath: [], attributes: { brand: "Kiln" } }) { id } }`;

  it('requires a token for writes', async () => {
    const r = await gql(CREATE_TEE);
    expect(r.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid tokens, even on reads', async () => {
    const r = await gql(`{ products { edges { cursor } } }`, {}, { ...acme, authorization: 'Bearer not-a-jwt' });
    expect(r.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it("rejects a token issued for another store", async () => {
    const verdeAdmin = await token({ tenant_id: 'verde-wholesale', roles: ['catalog:admin'] });
    const r = await gql(CREATE_TEE, {}, { ...acme, authorization: `Bearer ${verdeAdmin}` });
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    expect(r.errors?.[0]?.message).toMatch(/different store/);
  });

  it('rejects roles without write permission', async () => {
    const buyer = await token({ roles: ['buyer'] });
    const r = await gql(CREATE_TEE, {}, { ...acme, authorization: `Bearer ${buyer}` });
    expect(r.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('lets sellers add offers only for their own seller account', async () => {
    const seller = await token({ roles: ['seller'], seller_id: 'sel_newco' });
    const auth = { ...acme, authorization: `Bearer ${seller}` };
    expect((await gql(OFFER('sel_kora_rival'), {}, auth)).errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    expect((await gql(OFFER('sel_newco'), {}, auth)).errors).toBeUndefined();
  });

  it('ignores x-tenant-id from callers without the gateway secret (no tenant spoofing)', async () => {
    const spoofed = await gql(`{ products { edges { node { id } } } }`, {}, { host: 'verde.localhost', 'x-tenant-id': 'acme-mart' });
    const ids = spoofed.data!.products.edges.map((e: any) => e.node.id);
    expect(ids).not.toContain('prd_demo_phone');
    expect(ids).toContain('prd_demo_bolts');

    const wrongSecret = await gql(`{ products { edges { cursor } } }`, {}, { [GATEWAY_TOKEN_HEADER]: 'guess', 'x-tenant-id': 'acme-mart', host: 'unknown.example' });
    expect(wrongSecret.errors?.[0]?.extensions?.code).toBe('TENANT_NOT_FOUND');
  });

  it('enforces the parse-time token limit', async () => {
    const huge = `{ ${Array.from({ length: 3000 }, (_, i) => `a${i}: __typename`).join(' ')} }`;
    const r = await gql(huge);
    expect(r.errors?.[0]?.message).toMatch(/5000 tokens/);
  });
});
