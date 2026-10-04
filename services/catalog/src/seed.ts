import { readFileSync } from 'node:fs';
import { Roles } from '@lightshop/auth';
import { TenantLookup } from '@lightshop/tenancy';
import { CatalogService, AddOfferCommand, CreateProductCommand } from './application/catalog.service';
import { RequestContext } from './application/request-context';

type SeedProduct = CreateProductCommand & { id: string; offers: AddOfferCommand[] };

/** Demo data lives in config/demo/catalog.json (shared with the local-stack seeder that uses the public API). */
interface DemoFile {
  tenants: Record<string, SeedProduct[]>;
}

export function loadDemoCatalog(file: string): Record<string, SeedProduct[]> {
  return (JSON.parse(readFileSync(file, 'utf8')) as DemoFile).tenants;
}

export async function seedDemoData(catalog: CatalogService, registry: TenantLookup, demoFile: string): Promise<number> {
  const DEMO = loadDemoCatalog(demoFile);
  let created = 0;
  for (const tenant of registry.all()) {
    const products = DEMO[tenant.id];
    if (!products) continue;
    const ctx: RequestContext = {
      tenant, tenantId: tenant.id, region: tenant.regions[0]!, locale: tenant.locales[0]!, currency: tenant.currencies[0]!,
      // Internal system principal: seeding goes through the same authorization path as real writes.
      principal: { userId: 'system:seed', tenantId: tenant.id, roles: [Roles.CatalogAdmin] },
    };
    if ((await catalog.countProducts(ctx)) > 0) continue;
    for (const { id, offers, ...cmd } of products) {
      await catalog.createProduct(ctx, cmd, { id });
      for (const offer of offers) await catalog.addOffer(ctx, id, offer);
      created++;
    }
  }
  return created;
}
