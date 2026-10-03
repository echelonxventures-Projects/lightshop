import { mintDevToken } from '@lightshop/auth';

export const TEST_AUTH_SECRET = 'lightshop-test-secret-0123456789';

/** `Authorization` header value for a dev token, e.g. bearer({ tenant_id: 'acme-mart', roles: ['catalog:admin'] }). */
export async function bearer(
  claims: { tenant_id: string; roles: string[]; sub?: string; seller_id?: string; org_id?: string },
  secret = TEST_AUTH_SECRET,
): Promise<string> {
  return `Bearer ${await mintDevToken(secret, { sub: claims.sub ?? 'test_user', ...claims })}`;
}
