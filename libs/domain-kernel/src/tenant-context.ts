/**
 * Request-scoped tenancy. Every service call carries this, and every row a service stores
 * is keyed by `tenantId` (and `region` for data residency).
 *
 * Hierarchy: Tenant (white-label operator / brand) → Organization (seller or B2B buyer) → User.
 */
export type RegionCode = 'us' | 'eu' | 'in' | 'sea' | (string & {});

export interface TenantContext {
  tenantId: string;
  region: RegionCode;
  locale: string;
  currency: string;
  organizationId?: string;
  userId?: string;
  channel?: 'web' | 'app' | 'store' | 'api' | 'b2b-portal';
}

export const TENANT_HEADER = 'x-tenant-id';
export const REGION_HEADER = 'x-region';
export const LOCALE_HEADER = 'accept-language';

export function tenantContextFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  defaults: Pick<TenantContext, 'region' | 'locale' | 'currency'>,
): TenantContext {
  const pick = (name: string): string | undefined => {
    const v = headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const tenantId = pick(TENANT_HEADER);
  if (!tenantId) throw new Error(`Missing ${TENANT_HEADER} header`);
  return {
    tenantId,
    region: pick(REGION_HEADER) ?? defaults.region,
    locale: pick(LOCALE_HEADER)?.split(',')[0]?.trim() || defaults.locale,
    currency: pick('x-currency') ?? defaults.currency,
    organizationId: pick('x-organization-id'),
    userId: pick('x-user-id'),
  };
}
