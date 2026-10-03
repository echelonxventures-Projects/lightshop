import { DevTokenVerifier } from '@lightshop/auth';
import { describe, expect, it } from 'vitest';
import { TEST_AUTH_SECRET, bearer, eventually, testTenant } from './index';

describe('testing helpers', () => {
  it('builds unique valid tenants', () => {
    const a = testTenant();
    const b = testTenant({ currencies: ['EUR'] });
    expect(a.id).not.toBe(b.id);
    expect(b.currencies).toEqual(['EUR']);
  });

  it('mints bearer tokens the dev verifier accepts', async () => {
    const header = await bearer({ tenant_id: 't1', roles: ['seller'], seller_id: 's1' });
    const p = await new DevTokenVerifier(TEST_AUTH_SECRET, 'test').verify(header.replace('Bearer ', ''));
    expect(p).toMatchObject({ tenantId: 't1', sellerId: 's1' });
  });

  it('eventually resolves or times out', async () => {
    let n = 0;
    expect(await eventually(() => (++n >= 3 ? n : undefined), 1000, 1)).toBe(3);
    await expect(eventually(() => undefined, 20, 5)).rejects.toThrow(/within 20 ms/);
  });
});
