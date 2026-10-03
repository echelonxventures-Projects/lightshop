import 'server-only';
import { GATEWAY_TOKEN_HEADER } from '@lightshop/auth';
import { FileTenantSource, HttpTenantSource, LiveTenantRegistry, TenantConfig } from '@lightshop/tenancy';
import { headers } from 'next/headers';
import { join } from 'node:path';
import { cache } from 'react';

let registry: Promise<LiveTenantRegistry> | undefined;

/**
 * Tenant configs come from the tenant-registry service (TENANTS_URL) or, locally, config files.
 * Both are refreshed in the background: a store published in the admin console appears here
 * within TENANTS_REFRESH_MS with no deploy or restart.
 */
function getRegistry(): Promise<LiveTenantRegistry> {
  const secret = process.env.GATEWAY_SHARED_SECRET;
  registry ??= LiveTenantRegistry.start(
    process.env.TENANTS_URL
      ? new HttpTenantSource({ url: process.env.TENANTS_URL, headers: secret ? { [GATEWAY_TOKEN_HEADER]: secret } : {} })
      : new FileTenantSource(process.env.TENANTS_DIR ?? join(process.cwd(), '..', '..', 'config', 'tenants')),
    {
      intervalMs: Number(process.env.TENANTS_REFRESH_MS ?? 15_000),
      onError: (e) => console.error(`tenant refresh failed, keeping last good configs: ${e.message}`),
    },
  );
  return registry;
}

export interface StoreContext {
  tenant: TenantConfig;
  locale: string;
}

/** Resolve the white-label tenant from the Host header. Undefined → "store not found". */
export const getStore = cache(async (): Promise<StoreContext | undefined> => {
  const h = await headers();
  const tenant = (await getRegistry()).resolveHost(h.get('x-forwarded-host') ?? h.get('host'));
  if (!tenant) return undefined;
  const wanted = h.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim().toLowerCase();
  const lang = wanted?.split('-')[0];
  const locale =
    tenant.locales.find((l) => l.toLowerCase() === wanted) ??
    tenant.locales.find((l) => l.split('-')[0]!.toLowerCase() === lang) ??
    tenant.locales[0]!;
  return { tenant, locale };
});
