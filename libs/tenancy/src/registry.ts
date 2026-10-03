import { TenantConfig, parseTenantConfig } from './tenant-config';

/** Port for wherever tenant configs live (file system now, tenant-registry service later). */
export interface TenantSource {
  list(): Promise<unknown[]>;
}

/**
 * In-memory index of tenants by id and hostname. Validates every config up front and rejects
 * duplicate ids or domains so one tenant can never shadow another.
 */
export class TenantRegistry {
  private readonly byId = new Map<string, TenantConfig>();
  private readonly byHost = new Map<string, TenantConfig>();

  constructor(configs: unknown[]) {
    for (const raw of configs) {
      const tenant = parseTenantConfig(raw);
      if (this.byId.has(tenant.id)) throw new Error(`Duplicate tenant id: ${tenant.id}`);
      this.byId.set(tenant.id, tenant);
      for (const domain of tenant.domains) {
        const host = normalizeHost(domain);
        const owner = this.byHost.get(host);
        if (owner) throw new Error(`Domain ${host} claimed by both ${owner.id} and ${tenant.id}`);
        this.byHost.set(host, tenant);
      }
    }
  }

  static async load(source: TenantSource): Promise<TenantRegistry> {
    return new TenantRegistry(await source.list());
  }

  get(id: string): TenantConfig | undefined {
    return this.byId.get(id);
  }

  /** Resolve the tenant serving a request's Host header. Suspended/draft tenants do not resolve. */
  resolveHost(hostHeader: string | null | undefined): TenantConfig | undefined {
    if (!hostHeader) return undefined;
    const tenant = this.byHost.get(normalizeHost(hostHeader));
    return tenant?.status === 'live' ? tenant : undefined;
  }

  all(): TenantConfig[] {
    return [...this.byId.values()];
  }
}

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}
