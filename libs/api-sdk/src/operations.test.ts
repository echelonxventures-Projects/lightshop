import { schemaPath } from '@lightshop/contracts';
import { composeServices } from '@theguild/federation-composition';
import { buildSchema, parse, validate } from 'graphql';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LightshopApiError, Operations, createLightshopClient } from './index';

describe('SDK operations', () => {
  const composed = composeServices([{ name: 'catalog', url: 'http://catalog', typeDefs: parse(readFileSync(schemaPath('catalog'), 'utf8')) }]);
  const publicSchema = buildSchema(composed.publicSdl!);

  it.each(Object.entries(Operations))('%s is valid against the composed public schema', (_name, doc) => {
    expect(validate(publicSchema, parse(doc)).map((e) => e.message)).toEqual([]);
  });
});

describe('LightshopClient', () => {
  const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('maps pages and sends auth, locale and BFF headers', async () => {
    let sent: RequestInit | undefined;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      sent = init;
      return new Response(JSON.stringify({ data: { products: { edges: [{ node: { id: 'p1' } }], pageInfo: { hasNextPage: false, endCursor: 'c' } } } }));
    }) as unknown as typeof fetch;
    const client = createLightshopClient({ endpoint: 'http://gw/graphql', getToken: () => 't0k', locale: 'hi-IN', tenantId: 'verde-wholesale', gatewaySecret: 's', fetchImpl });
    const page = await client.products({ first: 1 });
    expect(page).toEqual({ items: [{ id: 'p1' }], hasNextPage: false, endCursor: 'c' });
    expect(sent?.headers).toMatchObject({ authorization: 'Bearer t0k', 'accept-language': 'hi-IN', 'x-tenant-id': 'verde-wholesale' });
  });

  it('throws typed errors with the API code and details', async () => {
    const client = createLightshopClient({
      endpoint: 'x',
      fetchImpl: reply(200, { errors: [{ message: 'bad', extensions: { code: 'VALIDATION_FAILED', details: ['model: required'] } }] }),
    });
    await expect(client.verticalPacks()).rejects.toMatchObject({ name: 'LightshopApiError', code: 'VALIDATION_FAILED', details: ['model: required'] });
    const limited = createLightshopClient({ endpoint: 'x', fetchImpl: reply(429, { errors: [{ message: 'slow down', extensions: { code: 'RATE_LIMITED' } }] }) });
    await expect(limited.product('p')).rejects.toBeInstanceOf(LightshopApiError);
  });

  it('omits the gateway secret header when none is configured (local dev)', async () => {
    let sent: RequestInit | undefined;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      sent = init;
      return new Response(JSON.stringify({ data: { verticalPacks: [] } }));
    }) as unknown as typeof fetch;
    await createLightshopClient({ endpoint: 'x', tenantId: 't', fetchImpl }).verticalPacks();
    expect(sent?.headers).toMatchObject({ 'x-tenant-id': 't' });
    expect(sent?.headers).not.toHaveProperty('x-lightshop-gateway-token');
  });
});
