import 'server-only';
import { headers } from 'next/headers';

/** The origin the browser used (behind a proxy, from X-Forwarded-*; only set by your own load balancer). */
export async function publicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return `${proto}://${host}`;
}
