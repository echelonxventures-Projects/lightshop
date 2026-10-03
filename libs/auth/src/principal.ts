/**
 * The authenticated caller, normalized from any OIDC provider's access token.
 * Expected claims: `sub`, `tenant_id`, `roles` (string[]), optional `seller_id` / `org_id`.
 * Keycloak, Ory, Zitadel, Auth0, Entra ID can all emit these via claim mappers.
 */
export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  sellerId?: string;
  organizationId?: string;
}

/** Platform-wide role names. Tenants map their IdP groups onto these. */
export const Roles = {
  CatalogAdmin: 'catalog:admin',
  Seller: 'seller',
  Buyer: 'buyer',
  PlatformAdmin: 'platform:admin',
} as const;

export function hasRole(principal: Principal, ...roles: string[]): boolean {
  return roles.some((r) => principal.roles.includes(r));
}

export function principalFromClaims(claims: Record<string, unknown>): Principal {
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
  const userId = str(claims.sub);
  const tenantId = str(claims.tenant_id);
  if (!userId) throw new AuthError('Token has no subject');
  if (!tenantId) throw new AuthError('Token has no tenant_id claim');
  const roles = Array.isArray(claims.roles) ? claims.roles.filter((r): r is string => typeof r === 'string') : [];
  return { userId, tenantId, roles, sellerId: str(claims.seller_id), organizationId: str(claims.org_id) };
}

export class AuthError extends Error {}
