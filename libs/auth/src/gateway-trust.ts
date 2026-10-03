import { timingSafeEqual } from 'node:crypto';

/** Header the gateway/BFF sets to prove it, not the end user, supplied identity headers. */
export const GATEWAY_TOKEN_HEADER = 'x-lightshop-gateway-token';

/**
 * Constant-time check of the gateway shared secret. In production this sits alongside mTLS from the
 * service mesh; it ensures x-tenant-id / x-user-id headers are only honoured from trusted callers.
 */
export function isTrustedGateway(presented: string | undefined, secret: string | undefined): boolean {
  if (!secret || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
