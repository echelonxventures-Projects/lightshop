import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { FileTenantSource, TenantRegistry, parseTenantConfig, themeToCss } from './index';

const base = {
  id: 'demo',
  brand: { name: 'Demo' },
  theme: { colorPrimary: '#112233' },
  domains: ['demo.localhost'],
  regions: ['us'],
  locales: ['en-US'],
  currencies: ['USD'],
  businessModels: ['d2c'],
  verticals: ['general'],
};

describe('TenantConfig', () => {
  it('applies defaults', () => {
    const t = parseTenantConfig(base);
    expect(t.status).toBe('live');
    expect(t.adapters.payments).toEqual(['manual']);
    expect(t.theme.radius).toBe('md');
  });

  it('reports every invalid field', () => {
    expect(() => parseTenantConfig({ ...base, id: 'Bad Id', currencies: ['usd'] })).toThrow(/id:.*\n.*currencies/s);
  });
});

describe('TenantRegistry', () => {
  it('resolves by host, ignoring port and case', () => {
    const reg = new TenantRegistry([base]);
    expect(reg.resolveHost('DEMO.localhost:3000')?.id).toBe('demo');
    expect(reg.resolveHost('other.localhost')).toBeUndefined();
  });

  it('does not resolve non-live tenants', () => {
    const reg = new TenantRegistry([{ ...base, status: 'suspended' }]);
    expect(reg.resolveHost('demo.localhost')).toBeUndefined();
  });

  it('rejects a domain claimed by two tenants', () => {
    expect(() => new TenantRegistry([base, { ...base, id: 'other' }])).toThrow(/claimed by both/);
  });

  it('loads and validates the shipped tenant configs', async () => {
    const reg = await TenantRegistry.load(new FileTenantSource(join(__dirname, '../../../config/tenants')));
    expect(reg.all().length).toBeGreaterThanOrEqual(2);
  });
});

describe('themeToCss', () => {
  it('emits CSS variables and strips injection attempts', () => {
    const css = themeToCss(parseTenantConfig({ ...base, theme: { colorPrimary: '#112233', fontFamily: 'x}</style><script>' } }).theme);
    expect(css).toContain('--ls-color-primary:#112233;');
    expect(css).not.toContain('</style>');
  });
});
