import { DevTokenVerifier } from './dev-tokens';
import { JwksTokenVerifier, TokenVerifier } from './token-verifier';

export type AuthConfig =
  | { mode: 'oidc'; issuer: string; audience: string; jwksUrl?: string }
  | { mode: 'dev'; secret: string };

/** Build the verifier a service should use from its AuthConfig. */
export function createTokenVerifier(config: AuthConfig): TokenVerifier {
  return config.mode === 'oidc'
    ? new JwksTokenVerifier({ issuer: config.issuer, audience: config.audience, jwksUrl: config.jwksUrl })
    : new DevTokenVerifier(config.secret);
}
