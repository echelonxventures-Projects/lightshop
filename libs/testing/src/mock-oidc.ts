import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { createServer } from 'node:http';

export interface MockUser {
  sub: string;
  name?: string;
  email?: string;
  tenant_id: string;
  roles: string[];
  seller_id?: string;
  org_id?: string;
}

export interface MockOidcOptions {
  port?: number;
  clientId?: string;
  clientSecret?: string;
  /** Audience put in access tokens (what APIs check). */
  audience?: string;
  /** Users selectable with `login_hint`; the first is used when no hint is given. */
  users: Record<string, MockUser>;
}

export interface MockOidcProvider {
  issuer: string;
  close(): Promise<void>;
  /** Mint an access token directly (API tests that don't need the browser flow). */
  accessToken(user: MockUser, overrides?: { audience?: string; issuer?: string; expiresIn?: string }): Promise<string>;
}

/**
 * Minimal, standards-compliant OIDC provider for tests: discovery, JWKS, authorization code + PKCE (S256),
 * token endpoint, end-session. Proves our login and token handling against the protocol, not a vendor.
 */
export async function startMockOidcProvider(options: MockOidcOptions): Promise<MockOidcProvider> {
  const clientId = options.clientId ?? 'lightshop-storefront';
  const clientSecret = options.clientSecret ?? 'mock-secret';
  const audience = options.audience ?? 'lightshop';
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'mock-1', alg: 'RS256', use: 'sig' };
  const codes = new Map<string, { user: MockUser; challenge: string; redirectUri: string; nonce?: string }>();
  let issuer = '';

  const sign = (claims: Record<string, unknown>, aud: string, exp = '15m', iss = issuer) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'mock-1' }).setIssuer(iss).setAudience(aud)
      .setIssuedAt().setExpirationTime(exp).sign(privateKey);
  const accessToken = (u: MockUser, o: { audience?: string; issuer?: string; expiresIn?: string } = {}) =>
    sign({ sub: u.sub, tenant_id: u.tenant_id, roles: u.roles, seller_id: u.seller_id, org_id: u.org_id, azp: clientId }, o.audience ?? audience, o.expiresIn, o.issuer);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', issuer);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    try {
      if (url.pathname === '/.well-known/openid-configuration') {
        return json(200, {
          issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`, end_session_endpoint: `${issuer}/logout`,
          response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
          scopes_supported: ['openid', 'profile', 'email'],
        });
      }
      if (url.pathname === '/jwks') return json(200, { keys: [jwk] });
      if (url.pathname === '/authorize') {
        const p = url.searchParams;
        if (p.get('client_id') !== clientId || p.get('response_type') !== 'code') return json(400, { error: 'invalid_request' });
        if (p.get('code_challenge_method') !== 'S256' || !p.get('code_challenge')) return json(400, { error: 'invalid_request', error_description: 'PKCE S256 required' });
        const hint = p.get('login_hint');
        const user = (hint && options.users[hint]) || Object.values(options.users)[0]!;
        const code = randomBytes(16).toString('hex');
        codes.set(code, { user, challenge: p.get('code_challenge')!, redirectUri: p.get('redirect_uri')!, nonce: p.get('nonce') ?? undefined });
        const back = new URL(p.get('redirect_uri')!);
        back.searchParams.set('code', code);
        if (p.get('state')) back.searchParams.set('state', p.get('state')!);
        back.searchParams.set('iss', issuer);
        res.writeHead(302, { location: back.toString() });
        return res.end();
      }
      if (url.pathname === '/token' && req.method === 'POST') {
        const body = new URLSearchParams(await readBody(req));
        const basic = req.headers.authorization?.match(/^Basic (.+)$/)?.[1];
        const [id, secret] = basic
          ? Buffer.from(basic, 'base64').toString().split(':').map(decodeURIComponent)
          : [body.get('client_id'), body.get('client_secret')];
        if (id !== clientId || secret !== clientSecret) return json(401, { error: 'invalid_client' });
        const grant = codes.get(body.get('code') ?? '');
        codes.delete(body.get('code') ?? '');
        if (!grant || grant.redirectUri !== body.get('redirect_uri')) return json(400, { error: 'invalid_grant' });
        const verifierHash = createHash('sha256').update(body.get('code_verifier') ?? '').digest('base64url');
        if (verifierHash !== grant.challenge) return json(400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
        const u = grant.user;
        return json(200, {
          token_type: 'Bearer', expires_in: 900, scope: 'openid profile email',
          access_token: await accessToken(u),
          id_token: await sign({ sub: u.sub, name: u.name, email: u.email, tenant_id: u.tenant_id, nonce: grant.nonce }, clientId),
        });
      }
      if (url.pathname === '/logout') {
        res.writeHead(302, { location: url.searchParams.get('post_logout_redirect_uri') ?? '/' });
        return res.end();
      }
      json(404, { error: 'not_found' });
    } catch (err) {
      json(500, { error: 'server_error', error_description: (err as Error).message });
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve));
  issuer = `http://localhost:${(server.address() as AddressInfo).port}`;
  return {
    issuer,
    accessToken,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
