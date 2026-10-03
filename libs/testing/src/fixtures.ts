import { TenantConfig, TenantConfigInput, parseTenantConfig } from '@lightshop/tenancy';

let seq = 0;

/** A valid, live TenantConfig with unique id/domain; override only what a test cares about. */
export function testTenant(overrides: Partial<TenantConfigInput> = {}): TenantConfig {
  const id = overrides.id ?? `test-tenant-${++seq}`;
  return parseTenantConfig({
    id,
    brand: { name: `Test Store ${seq}` },
    theme: { colorPrimary: '#334455' },
    domains: [`${id}.test`],
    regions: ['us'],
    locales: ['en-US'],
    currencies: ['USD'],
    businessModels: ['d2c'],
    verticals: ['general'],
    ...overrides,
  });
}
