import { LOCALE_HEADER, REGION_HEADER, TENANT_HEADER } from '@lightshop/domain-kernel';
import { TenantRegistry } from '@lightshop/tenancy';
import type { Request } from 'express';
import { CatalogError } from '../application/errors';
import { RequestContext } from '../application/request-context';

export interface GqlContext {
  req: Request;
  ctx?: RequestContext;
}

/**
 * Resolves the white-label tenant for a request: explicit x-tenant-id (set by the gateway/BFF),
 * else the Host header. Region/locale/currency requests are clamped to what the tenant enabled.
 */
export function buildContext(req: Request, registry: TenantRegistry): GqlContext {
  const header = (name: string) => {
    const v = req.headers[name];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const tenantId = header(TENANT_HEADER);
  const tenant = tenantId ? registry.get(tenantId) : registry.resolveHost(req.headers.host);
  if (!tenant || tenant.status !== 'live') return { req };

  const pick = (wanted: string | undefined, allowed: string[]) =>
    (wanted && allowed.find((a) => a.toLowerCase() === wanted.toLowerCase())) ?? allowed[0]!;
  const locale = matchLocale(header(LOCALE_HEADER)?.split(',')[0]?.split(';')[0], tenant.locales);

  return {
    req,
    ctx: {
      tenant,
      tenantId: tenant.id,
      region: pick(header(REGION_HEADER), tenant.regions),
      locale,
      currency: pick(header('x-currency'), tenant.currencies),
      userId: header('x-user-id'),
      organizationId: header('x-organization-id'),
    },
  };
}

/** Exact locale, then same language ("pt-PT" → "pt-BR"), then the tenant default. */
export function matchLocale(requested: string | undefined, allowed: string[]): string {
  const fallback = allowed[0]!;
  if (!requested) return fallback;
  const exact = allowed.find((a) => a.toLowerCase() === requested.toLowerCase());
  const lang = requested.split('-')[0]!.toLowerCase();
  return exact ?? allowed.find((a) => a.split('-')[0]!.toLowerCase() === lang) ?? fallback;
}

export function requireContext(gql: GqlContext): RequestContext {
  if (!gql.ctx) throw new CatalogError('TENANT_NOT_FOUND', 'Unknown or inactive tenant');
  return gql.ctx;
}
