import { JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthError, Principal, principalFromClaims } from './principal';

/** Port: turn a bearer token into a Principal, or throw AuthError. */
export interface TokenVerifier {
  verify(token: string): Promise<Principal>;
}

export interface JwksVerifierOptions {
  issuer: string;
  audience: string;
  /** Defaults to OIDC discovery-free convention `<issuer>/.well-known/jwks.json` only if not given. */
  jwksUrl?: string;
  /** Inject a key set directly (tests, air-gapped deployments). */
  keySet?: JWTVerifyGetKey;
  algorithms?: string[];
}

/** Verifies RS256/ES256/EdDSA tokens from any standards-compliant OIDC provider. */
export class JwksTokenVerifier implements TokenVerifier {
  private readonly keySet: JWTVerifyGetKey;

  constructor(private readonly options: JwksVerifierOptions) {
    this.keySet =
      options.keySet ?? createRemoteJWKSet(new URL(options.jwksUrl ?? `${options.issuer.replace(/\/$/, '')}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<Principal> {
    try {
      const { payload } = await jwtVerify(token, this.keySet, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: this.options.algorithms ?? ['RS256', 'ES256', 'EdDSA'],
        clockTolerance: 30,
      });
      return principalFromClaims(payload);
    } catch (err) {
      throw err instanceof AuthError ? err : new AuthError(`Invalid access token: ${(err as Error).message}`);
    }
  }
}
