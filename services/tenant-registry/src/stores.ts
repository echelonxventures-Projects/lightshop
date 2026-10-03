import { RegistryConfig } from './config';
import { InMemoryTenantStore } from './infrastructure/memory-tenant-store';
import { PostgresTenantStore } from './infrastructure/postgres-tenant-store';
import { TenantStore } from './infrastructure/tenant-store';

export async function createTenantStore(config: RegistryConfig): Promise<TenantStore> {
  return config.databaseUrl ? PostgresTenantStore.connect(config.databaseUrl) : new InMemoryTenantStore();
}
