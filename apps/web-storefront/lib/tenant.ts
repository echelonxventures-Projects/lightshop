import 'server-only';
import { FileTenantSource, TenantConfig, TenantRegistry } from '@lightshop/tenancy';
import { headers } from 'next/headers';
import { join } from 'node:path';
import { cache } from 'react';

let registry: Promise<TenantRegistry> | undefined;

/**
 * Tenant configs are loaded once per server process. A new store = a new config file
 * (or, later, a row in the tenant-registry service) — this app never changes.
 */
function getRegistry(): Promise<TenantRegistry> {
  registry ??= TenantRegistry.load(
    new FileTenantSource(process.env.TENANTS_DIR ?? join(process.cwd(), '..', '..', 'config', 'tenants')),
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
