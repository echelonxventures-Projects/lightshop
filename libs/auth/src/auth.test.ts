import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { describe, expect, it } from 'vitest';
import { DevTokenVerifier, JwksTokenVerifier, Roles, hasRole, isTrustedGateway, mintDevToken } from './index';

const SECRET = 'test-secret-0123456789';

describe('DevTokenVerifier', () => {
  it('round-trips a minted token into a principal', async () => {
    const token = await mintDevToken(SECRET, { sub: 'u1', tenant_id: 'acme-mart', roles: [Roles.Seller], seller_id: 's1' });
    const p = await new DevTokenVerifier(SECRET, 'test').verify(token);
    expect(p).toEqual({ userId: 'u1', tenantId: 'acme-mart', roles: ['seller'], sellerId: 's1', organizationId: undefined });
    expect(hasRole(p, Roles.CatalogAdmin, Roles.Seller)).toBe(true);
  });

  it('rejects tampered tokens, wrong secrets and missing tenant', async () => {
    const v = new DevTokenVerifier(SECRET, 'test');
    const token = await mintDevToken(SECRET, { sub: 'u1', tenant_id: 't', roles: [] });
    await expect(v.verify(token.slice(0, -2) + 'xx')).rejects.toThrow(/Invalid dev token/);
    await expect(new DevTokenVerifier('another-secret-0123456', 'test').verify(token)).rejects.toThrow();
    const noTenant = await mintDevToken(SECRET, { sub: 'u1', tenant_id: '', roles: [] });
    await expect(v.verify(noTenant)).rejects.toThrow(/tenant_id/);
  });

  it('refuses to run in production', () => {
    expect(() => new DevTokenVerifier(SECRET, 'production')).toThrow(/production/);
  });
});

describe('JwksTokenVerifier', () => {
  it('verifies asymmetric tokens and enforces issuer/audience', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    const keySet = createLocalJWKSet({ keys: [jwk] });
    const sign = (iss: string, aud: string) =>
      new SignJWT({ tenant_id: 'verde-wholesale', roles: ['catalog:admin'] })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setSubject('u9').setIssuer(iss).setAudience(aud).setExpirationTime('5m').sign(privateKey);

    const v = new JwksTokenVerifier({ issuer: 'https://idp.example/realms/x', audience: 'lightshop', keySet });
    expect((await v.verify(await sign('https://idp.example/realms/x', 'lightshop'))).tenantId).toBe('verde-wholesale');
    await expect(v.verify(await sign('https://evil.example', 'lightshop'))).rejects.toThrow(/Invalid access token/);
    await expect(v.verify(await sign('https://idp.example/realms/x', 'other'))).rejects.toThrow(/Invalid access token/);
  });
});

describe('isTrustedGateway', () => {
  it('compares secrets in constant time and fails closed', () => {
    expect(isTrustedGateway('s3cret', 's3cret')).toBe(true);
    expect(isTrustedGateway('s3cret', 's3cre')).toBe(false);
    expect(isTrustedGateway(undefined, 's3cret')).toBe(false);
    expect(isTrustedGateway('x', undefined)).toBe(false);
  });
});
