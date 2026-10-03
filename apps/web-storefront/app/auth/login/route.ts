import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { discover, oidcSettings } from '../../../lib/oidc';
import { LOGIN_COOKIE, cookieOptions, randomToken, seal } from '../../../lib/session';
import { getStore } from '../../../lib/tenant';
import { publicOrigin } from '../../../lib/url';

export async function GET(req: NextRequest) {
  const settings = oidcSettings();
  const store = await getStore();
  if (!settings || !store) return NextResponse.json({ error: 'Sign-in is not configured for this store' }, { status: 404 });

  const origin = await publicOrigin();
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get('returnTo'));
  const d = await discover(settings);

  const authorize = new URL(d.authorization_endpoint);
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: settings.clientId,
    redirect_uri: `${origin}/auth/callback`,
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    ...(req.nextUrl.searchParams.get('login_hint') ? { login_hint: req.nextUrl.searchParams.get('login_hint')! } : {}),
  }).toString();

  const res = NextResponse.redirect(authorize);
  res.cookies.set(LOGIN_COOKIE, await seal({ state, nonce, verifier, returnTo, tenantId: store.tenant.id }, 600), cookieOptions(600));
  return res;
}

/** Only same-site relative paths: prevents open redirects. */
function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
