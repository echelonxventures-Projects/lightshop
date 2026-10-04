import { decodeJwt } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, oidcSettings, verifyIdToken } from '../../../lib/oidc';
import { LOGIN_COOKIE, SESSION_COOKIE, Session, cookieOptions, seal, unseal } from '../../../lib/session';
import { getStore } from '../../../lib/tenant';
import { publicOrigin } from '../../../lib/url';

interface LoginState { state: string; nonce: string; verifier: string; returnTo: string; tenantId: string }

export async function GET(req: NextRequest) {
  const settings = oidcSettings();
  const store = await getStore();
  const origin = await publicOrigin();
  if (!settings || !store) return NextResponse.redirect(`${origin}/`);

  // The IdP reports failures on the redirect (RFC 6749 §4.1.2.1); surface them instead of guessing.
  const idpError = req.nextUrl.searchParams.get('error');
  if (idpError) {
    console.error(`sign-in rejected by identity provider: ${idpError} ${req.nextUrl.searchParams.get('error_description') ?? ''}`);
    return fail(origin, idpError === 'access_denied' ? 'denied' : 'failed');
  }

  const login = await unseal<LoginState>(req.cookies.get(LOGIN_COOKIE)?.value);
  const code = req.nextUrl.searchParams.get('code');
  if (!login || !code || req.nextUrl.searchParams.get('state') !== login.state || login.tenantId !== store.tenant.id) {
    return fail(origin, 'state');
  }

  try {
    const tokens = await exchangeCode(settings, code, `${origin}/auth/callback`, login.verifier);
    const id = await verifyIdToken(settings, tokens.id_token, login.nonce);
    // The API re-verifies the access token; here we only bind the session to this store.
    const access = decodeJwt(tokens.access_token) as { tenant_id?: string; exp?: number };
    const tenantId = access.tenant_id ?? id.tenant_id;
    if (tenantId !== store.tenant.id) return fail(origin, 'other-store');

    const ttl = Math.max(60, Math.min(tokens.expires_in ?? 900, 8 * 3600));
    const session: Session = {
      sub: id.sub, name: id.name, email: id.email, tenantId, accessToken: tokens.access_token, idToken: tokens.id_token,
      exp: access.exp ?? Math.floor(Date.now() / 1000) + ttl,
    };
    const res = NextResponse.redirect(`${origin}${login.returnTo}`);
    res.cookies.set(SESSION_COOKIE, await seal({ ...session }, ttl), cookieOptions(ttl));
    res.cookies.delete(LOGIN_COOKIE);
    return res;
  } catch (err) {
    console.error(`sign-in failed: ${(err as Error).message}`);
    return fail(origin, 'failed');
  }
}

function fail(origin: string, reason: string) {
  const res = NextResponse.redirect(`${origin}/auth/error?reason=${reason}`);
  res.cookies.delete(LOGIN_COOKIE);
  return res;
}
