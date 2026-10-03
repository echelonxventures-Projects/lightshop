import { describe, expect, it } from 'vitest';
import { HttpTenantSource, LiveTenantRegistry, NOT_MODIFIED, TenantSource } from './index';

const tenant = (id: string, domain = `${id}.localhost`, extra: object = {}) => ({
  id, brand: { name: id }, theme: { colorPrimary: '#112233' }, domains: [domain], regions: ['us'],
  locales: ['en-US'], currencies: ['USD'], businessModels: ['d2c'], verticals: ['general'], ...extra,
});

class MutableSource implements TenantSource {
  constructor(public configs: unknown[] | Error) {}
  async list() {
    if (this.configs instanceof Error) throw this.configs;
    return this.configs;
  }
}

describe('LiveTenantRegistry', () => {
  it('applies new tenants on refresh (zero-code launch without restart)', async () => {
    const src = new MutableSource([tenant('aa')]);
    const live = await LiveTenantRegistry.start(src);
    expect(live.resolveHost('bb.localhost')).toBeUndefined();
    src.configs = [tenant('aa'), tenant('bb')];
    expect(await live.refresh()).toBe(true);
    expect(live.resolveHost('bb.localhost')?.id).toBe('bb');
  });

  it('keeps the last good snapshot when a refresh is invalid or fails', async () => {
    const errors: string[] = [];
    const src = new MutableSource([tenant('aa')]);
    const live = await LiveTenantRegistry.start(src, { onError: (e) => errors.push(e.message) });
    src.configs = [tenant('aa'), tenant('bb', 'aa.localhost')]; // domain conflict
    expect(await live.refresh()).toBe(false);
    src.configs = new Error('registry down');
    expect(await live.refresh()).toBe(false);
    expect(live.resolveHost('aa.localhost')?.id).toBe('aa');
    expect(errors).toEqual([expect.stringMatching(/claimed by both/), 'registry down']);
  });

  it('refuses to start without a valid initial snapshot', async () => {
    await expect(LiveTenantRegistry.start(new MutableSource([{ id: 'X' }]))).rejects.toThrow(/Invalid TenantConfig/);
  });

  it('treats NOT_MODIFIED as no change', async () => {
    const src = new MutableSource([tenant('aa')]);
    const live = await LiveTenantRegistry.start(src);
    src.configs = NOT_MODIFIED;
    expect(await live.refresh()).toBe(false);
    expect(live.all()).toHaveLength(1);
  });
});

describe('HttpTenantSource', () => {
  it('sends headers, then uses ETag for conditional polling', async () => {
    const calls: Array<Record<string, string>> = [];
    const fetchImpl = (async (_url: string, init: { headers: Record<string, string> }) => {
      calls.push(init.headers);
      if (init.headers['if-none-match'] === '"v1"') return new Response(null, { status: 304 });
      return new Response(JSON.stringify({ tenants: [tenant('aa')] }), { status: 200, headers: { etag: '"v1"' } });
    }) as unknown as typeof fetch;
    const src = new HttpTenantSource({ url: 'http://registry/v1/tenants', headers: { 'x-k': 'v' }, fetchImpl });
    expect(await src.list()).toHaveLength(1);
    expect(await src.list()).toBe(NOT_MODIFIED);
    expect(calls[0]).toMatchObject({ 'x-k': 'v' });
    expect(calls[1]).toMatchObject({ 'if-none-match': '"v1"' });
  });

  it('surfaces registry errors', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch;
    await expect(new HttpTenantSource({ url: 'http://r', fetchImpl }).list()).rejects.toThrow(/503/);
  });
});
