import 'reflect-metadata';
import { GATEWAY_TOKEN_HEADER } from '@lightshop/auth';
import { HttpTenantSource, LiveTenantRegistry } from '@lightshop/tenancy';
import { TEST_AUTH_SECRET, bearer } from '@lightshop/testing';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { RegistryModule } from '../src/registry.module';

const GATEWAY = 'registry-e2e-gateway-secret';
let app: INestApplication;
let url: string;
let adminAuth: string;
const txt = new Map<string, string[][]>();

beforeAll(async () => {
  const config = {
    ...loadConfig({ DEV_AUTH_SECRET: TEST_AUTH_SECRET, GATEWAY_SHARED_SECRET: GATEWAY }),
    seedTenantsDir: join(__dirname, '../../../config/tenants'),
    outboxIntervalMs: 60_000,
  };
  const moduleRef = await Test.createTestingModule({
    imports: [RegistryModule.forRoot(config, { txtResolver: async (name) => txt.get(name) ?? [] })],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  url = await app.getUrl();
  adminAuth = await bearer({ tenant_id: '*', roles: ['platform:admin'] });
});

afterAll(() => app?.close());

const http = () => request(app.getHttpServer());
const bloom = (domains: string[]) => ({
  brand: { name: 'Bloom' }, theme: { colorPrimary: '#B0306A' }, domains, regions: ['eu'],
  locales: ['en-GB', 'fr-FR'], currencies: ['EUR'], businessModels: ['d2c'], verticals: ['general'],
});

describe('tenant-registry HTTP API', () => {
  it('imports the file-based tenants at startup and serves them to internal callers only', async () => {
    expect((await http().get('/v1/tenants')).status).toBe(401);
    const res = await http().get('/v1/tenants?status=live').set(GATEWAY_TOKEN_HEADER, GATEWAY);
    expect(res.status).toBe(200);
    expect(res.body.tenants.map((t: { id: string }) => t.id).sort()).toEqual(['acme-mart', 'verde-wholesale']);
    const again = await http().get('/v1/tenants?status=live').set(GATEWAY_TOKEN_HEADER, GATEWAY).set('if-none-match', res.headers.etag!);
    expect(again.status).toBe(304);
  });

  it('requires auth for writes and returns structured validation errors', async () => {
    expect((await http().put('/v1/tenants/bloom').send(bloom(['bloom.localhost']))).body.code).toBe('UNAUTHENTICATED');
    const bad = await http().put('/v1/tenants/bloom').set('authorization', adminAuth).send({ ...bloom([]), theme: { colorPrimary: 'pink' } });
    expect(bad.status).toBe(422);
    expect(bad.body.details).toEqual(expect.arrayContaining([expect.stringMatching(/theme\.colorPrimary/), expect.stringMatching(/domains/)]));
  });

  it('launches a store with zero code: create → launch → live, and consumers pick it up without restart', async () => {
    const live = await LiveTenantRegistry.start(
      new HttpTenantSource({ url: `${url}/v1/tenants?status=live`, headers: { [GATEWAY_TOKEN_HEADER]: GATEWAY } }),
    );
    expect(live.resolveHost('bloom.localhost')).toBeUndefined();

    const created = await http().put('/v1/tenants/bloom').set('authorization', adminAuth).send(bloom(['bloom.localhost']));
    expect(created.status).toBe(200);
    expect(created.body.config.status).toBe('draft');
    expect(await live.refresh()).toBe(false);

    const launched = await http().post('/v1/tenants/bloom/launch').set('authorization', adminAuth);
    expect(launched.status).toBe(202);
    expect(launched.body).toMatchObject({ mode: 'inline', result: { tenantId: 'bloom', version: 2 } });

    expect(await live.refresh()).toBe(true);
    expect(live.resolveHost('bloom.localhost')?.brand.name).toBe('Bloom');
    const status = await http().get('/v1/tenants/bloom/launch').set('authorization', adminAuth);
    expect(status.body).toMatchObject({ status: 'COMPLETED', progress: { step: 'live' } });
  });

  it('requires DNS proof of ownership for real domains', async () => {
    await http().put('/v1/tenants/rose').set('authorization', adminAuth).send(bloom(['shop.rose.example']));
    const blocked = await http().post('/v1/tenants/rose/launch').set('authorization', adminAuth);
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/_lightshop-challenge\.shop\.rose\.example = "lightshop-verify=rose"/);

    txt.set('_lightshop-challenge.shop.rose.example', [['lightshop-verify=rose']]);
    expect((await http().post('/v1/tenants/rose/launch').set('authorization', adminAuth)).status).toBe(202);
  });

  it('rejects stale edits with If-Match', async () => {
    const current = await http().get('/v1/tenants/bloom').set(GATEWAY_TOKEN_HEADER, GATEWAY);
    const v = current.body.version as number;
    const ok = await http().put('/v1/tenants/bloom').set('authorization', adminAuth).set('if-match', `"v${v}"`).send(bloom(['bloom.localhost']));
    expect(ok.status).toBe(200);
    const stale = await http().put('/v1/tenants/bloom').set('authorization', adminAuth).set('if-match', `"v${v}"`).send(bloom(['bloom.localhost']));
    expect(stale.status).toBe(409);
  });

  it('only platform admins can launch or suspend', async () => {
    const owner = await bearer({ tenant_id: 'bloom', roles: ['tenant:admin'] });
    expect((await http().post('/v1/tenants/bloom/suspend').set('authorization', owner)).status).toBe(403);
    expect((await http().post('/v1/tenants/bloom/launch').set('authorization', owner)).status).toBe(403);
  });
});
