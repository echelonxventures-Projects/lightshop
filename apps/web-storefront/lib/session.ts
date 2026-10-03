import 'server-only';
import { EncryptJWT, base64url, jwtDecrypt } from 'jose';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { StoreContext } from './tenant';

export const SESSION_COOKIE = 'ls_session';
export const LOGIN_COOKIE = 'ls_oidc';

export interface Session {
  sub: string;
  name?: string;
  email?: string;
  tenantId: string;
  accessToken: string;
  exp: number;
}

/** A 256-bit key derived from SESSION_SECRET; cookies are encrypted (JWE dir/A256GCM), not just signed. */
function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET of at least 32 characters is required for sign-in');
  return createHash('sha256').update(secret).digest();
}

export async function seal(payload: Record<string, unknown>, ttlSeconds: number): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(key());
}

export async function unseal<T>(token: string | undefined): Promise<T | undefined> {
  if (!token) return undefined;
  try {
    return (await jwtDecrypt(token, key())).payload as T;
  } catch {
    return undefined;
  }
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

/** The signed-in user for *this* store, if any. A session from another store is ignored. */
export async function getSession(store: StoreContext): Promise<Session | undefined> {
  if (!process.env.SESSION_SECRET) return undefined;
  const session = await unseal<Session>((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.tenantId !== store.tenant.id || session.exp * 1000 < Date.now()) return undefined;
  return session;
}

export const randomToken = () => base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
