import { SignJWT, jwtVerify } from 'jose';
import { AuthError, Principal, principalFromClaims } from './principal';
import { TokenVerifier } from './token-verifier';

const DEV_ISSUER = 'lightshop-dev';
const DEV_AUDIENCE = 'lightshop';

/**
 * Shared-secret HS256 tokens for local development and tests, so no IdP is needed.
 * Refuses to construct when NODE_ENV=production.
 */
export class DevTokenVerifier implements TokenVerifier {
  private readonly key: Uint8Array;

  constructor(secret: string, env: string | undefined = process.env.NODE_ENV) {
    if (env === 'production') throw new Error('DevTokenVerifier must not be used in production');
    if (secret.length < 16) throw new Error('Dev auth secret must be at least 16 characters');
    this.key = new TextEncoder().encode(secret);
  }

  async verify(token: string): Promise<Principal> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: DEV_ISSUER, audience: DEV_AUDIENCE, algorithms: ['HS256'] });
      return principalFromClaims(payload);
    } catch (err) {
      throw err instanceof AuthError ? err : new AuthError(`Invalid dev token: ${(err as Error).message}`);
    }
  }
}

export async function mintDevToken(
  secret: string,
  claims: { sub: string; tenant_id: string; roles: string[]; seller_id?: string; org_id?: string },
  ttl = '8h',
): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(DEV_ISSUER)
    .setAudience(DEV_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(new TextEncoder().encode(secret));
}
