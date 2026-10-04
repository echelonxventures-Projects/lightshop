import { NextRequest, NextResponse } from 'next/server';
import { discover, oidcSettings } from '../../../lib/oidc';
import { SESSION_COOKIE, Session, unseal } from '../../../lib/session';
import { publicOrigin } from '../../../lib/url';

export async function GET(req: NextRequest) {
  const origin = await publicOrigin();
  const settings = oidcSettings();
  let target = `${origin}/`;
  if (settings) {
    const d = await discover(settings).catch(() => undefined);
    if (d?.end_session_endpoint) {
      const url = new URL(d.end_session_endpoint);
      url.searchParams.set('client_id', settings.clientId);
      url.searchParams.set('post_logout_redirect_uri', `${origin}/`);
      const session = await unseal<Session>(req.cookies.get(SESSION_COOKIE)?.value);
      if (session?.idToken) url.searchParams.set('id_token_hint', session.idToken);
      target = url.toString();
    }
  }
  const res = NextResponse.redirect(target);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
