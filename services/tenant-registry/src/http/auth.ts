import { AuthError, GATEWAY_TOKEN_HEADER, Principal, TokenVerifier, isTrustedGateway } from '@lightshop/auth';
import type { Request } from 'express';
import { RegistryError } from '../application/errors';

export async function principalFrom(req: Request, verifier: TokenVerifier): Promise<Principal> {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new RegistryError('UNAUTHENTICATED', 'Sign in required');
  try {
    return await verifier.verify(token);
  } catch (err) {
    throw new RegistryError('UNAUTHENTICATED', err instanceof AuthError ? err.message : 'Invalid access token');
  }
}

/**
 * Reads of tenant configs are internal: allowed for the gateway/services (shared secret) or a platform admin.
 * Outside production with no secret configured, internal reads are open (local dev).
 */
export async function assertInternalReader(
  req: Request,
  verifier: TokenVerifier,
  gatewaySecret: string | undefined,
  production: boolean,
): Promise<void> {
  const presented = req.headers[GATEWAY_TOKEN_HEADER];
  if (isTrustedGateway(Array.isArray(presented) ? presented[0] : presented, gatewaySecret)) return;
  if (!gatewaySecret && !production) return;
  const principal = await principalFrom(req, verifier);
  if (!principal.roles.includes('platform:admin')) throw new RegistryError('FORBIDDEN', 'Internal endpoint');
}
