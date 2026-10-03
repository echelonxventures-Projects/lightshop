import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Standard OIDC (any provider): discovery, authorization code + PKCE, ID token validation. */
export interface OidcSettings {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export function oidcSettings(): OidcSettings | undefined {
  const { OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, SESSION_SECRET } = process.env;
  if (!OIDC_ISSUER || !OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET || !SESSION_SECRET) return undefined;
  return { issuer: OIDC_ISSUER.replace(/\/$/, ''), clientId: OIDC_CLIENT_ID, clientSecret: OIDC_CLIENT_SECRET };
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

let discovery: Promise<Discovery> | undefined;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export function discover(settings: OidcSettings): Promise<Discovery> {
  discovery ??= fetch(`${settings.issuer}/.well-known/openid-configuration`, { cache: 'no-store' }).then(async (r) => {
    if (!r.ok) throw new Error(`OIDC discovery failed: ${r.status}`);
    return (await r.json()) as Discovery;
  });
  discovery.catch(() => (discovery = undefined));
  return discovery;
}

export async function exchangeCode(settings: OidcSettings, code: string, redirectUri: string, codeVerifier: string) {
  const d = await discover(settings);
  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${encodeURIComponent(settings.clientId)}:${encodeURIComponent(settings.clientSecret)}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return (await res.json()) as { access_token: string; id_token: string; expires_in?: number };
}

export async function verifyIdToken(settings: OidcSettings, idToken: string, nonce: string) {
  const d = await discover(settings);
  jwks ??= createRemoteJWKSet(new URL(d.jwks_uri));
  const { payload } = await jwtVerify(idToken, jwks, { issuer: d.issuer, audience: settings.clientId });
  if (payload.nonce !== nonce) throw new Error('ID token nonce mismatch');
  return payload as { sub: string; name?: string; email?: string; tenant_id?: string };
}
