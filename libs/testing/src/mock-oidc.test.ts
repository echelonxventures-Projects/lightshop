import { JwksTokenVerifier } from '@lightshop/auth';
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockOidcProvider, startMockOidcProvider } from './mock-oidc';

let idp: MockOidcProvider;
const ana = { sub: 'usr_ana', tenant_id: 'acme-mart', roles: ['buyer'] };

beforeAll(async () => {
  idp = await startMockOidcProvider({ users: { ana } });
});
afterAll(() => idp.close());

describe('mock OIDC provider', () => {
  it('issues access tokens verifiable through its JWKS', async () => {
    const v = new JwksTokenVerifier({ issuer: idp.issuer, audience: 'lightshop', jwksUrl: `${idp.issuer}/jwks` });
    expect(await v.verify(await idp.accessToken(ana))).toMatchObject({ userId: 'usr_ana', tenantId: 'acme-mart', roles: ['buyer'] });
  });

  it('runs authorization code + PKCE and rejects a wrong verifier', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const authorize = `${idp.issuer}/authorize?client_id=lightshop-storefront&response_type=code&redirect_uri=${encodeURIComponent('http://app/cb')}&state=s1&code_challenge=${challenge}&code_challenge_method=S256`;
    const redirect = new URL((await fetch(authorize, { redirect: 'manual' })).headers.get('location')!);
    expect(redirect.searchParams.get('state')).toBe('s1');
    const exchange = (code: string, codeVerifier: string) =>
      fetch(`${idp.issuer}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${Buffer.from('lightshop-storefront:mock-secret').toString('base64')}` },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: 'http://app/cb', code_verifier: codeVerifier }),
      });
    expect((await exchange(redirect.searchParams.get('code')!, 'wrong')).status).toBe(400);
    // codes are single-use, so start a second flow for the success path
    const again = new URL((await fetch(authorize, { redirect: 'manual' })).headers.get('location')!);
    const ok = await exchange(again.searchParams.get('code')!, verifier);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ token_type: 'Bearer', access_token: expect.any(String), id_token: expect.any(String) });
  });
});
