import { AuthError, GATEWAY_TOKEN_HEADER, Principal, TokenVerifier, isTrustedGateway } from '@lightshop/auth';
import { LOCALE_HEADER, REGION_HEADER, TENANT_HEADER } from '@lightshop/domain-kernel';
import { TenantRegistry } from '@lightshop/tenancy';
import type { Request } from 'express';
import { CatalogError } from '../application/errors';
import { RequestContext } from '../application/request-context';

export interface GqlContext {
  req: Request;
  ctx?: RequestContext;
  /** Why a presented bearer token was rejected (surfaced only when a mutation needs auth). */
  authError?: string;
}

export interface ContextDeps {
  registry: TenantRegistry;
  verifier: TokenVerifier;
  gatewaySecret?: string;
  /** Outside production with no gateway secret configured, identity headers are trusted (local dev). */
  trustHeadersWithoutGateway: boolean;
}

/**
 * Resolves the white-label tenant and caller for a request.
 * - Tenant: `x-tenant-id` only from a trusted gateway/BFF; otherwise the Host header. Spoofed headers are ignored.
 * - Caller: only from a verified bearer token, never from plain headers.
 * Region/locale/currency are clamped to what the tenant enabled.
 */
export async function buildContext(req: Request, deps: ContextDeps): Promise<GqlContext> {
  const header = (name: string) => {
    const v = req.headers[name];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const trusted = deps.gatewaySecret
    ? isTrustedGateway(header(GATEWAY_TOKEN_HEADER), deps.gatewaySecret)
    : deps.trustHeadersWithoutGateway;

  const tenantId = trusted ? header(TENANT_HEADER) : undefined;
  const tenant = tenantId ? deps.registry.get(tenantId) : deps.registry.resolveHost(req.headers.host);
  if (!tenant || tenant.status !== 'live') return { req };

  let principal: Principal | undefined;
  let authError: string | undefined;
  const bearer = header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    try {
      principal = await deps.verifier.verify(bearer);
    } catch (err) {
      authError = err instanceof AuthError ? err.message : 'Invalid access token';
    }
  }

  const pick = (wanted: string | undefined, allowed: string[]) =>
    (wanted && allowed.find((a) => a.toLowerCase() === wanted.toLowerCase())) ?? allowed[0]!;

  return {
    req,
    authError,
    ctx: {
      tenant,
      tenantId: tenant.id,
      region: pick(header(REGION_HEADER), tenant.regions),
      locale: matchLocale(header(LOCALE_HEADER)?.split(',')[0]?.split(';')[0], tenant.locales),
      currency: pick(header('x-currency'), tenant.currencies),
      principal,
      userId: principal?.userId,
      organizationId: principal?.organizationId,
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
  if (gql.authError) throw new CatalogError('UNAUTHENTICATED', gql.authError);
  return gql.ctx;
}
