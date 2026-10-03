import { DomainEvent } from '@lightshop/adapters';
import { Principal, Roles, hasRole } from '@lightshop/auth';
import { TenancyEventTypes, TenantChangedPayload, Topics } from '@lightshop/contracts';
import { newId } from '@lightshop/domain-kernel';
import { TenantConfig, normalizeHost, parseTenantConfig } from '@lightshop/tenancy';
import { TenantRecord, TenantStatus } from '../domain/tenant-record';
import { TenantStore, VersionConflictError } from '../infrastructure/tenant-store';
import { RegistryError } from './errors';

export const SYSTEM_PRINCIPAL: Principal = { userId: 'system', tenantId: '*', roles: [Roles.PlatformAdmin] };

/**
 * Owns the lifecycle of white-label stores: draft → live → suspended.
 * Every change is validated, versioned (optimistic concurrency), audited and published as an event.
 */
export class TenantRegistryService {
  constructor(private readonly store: TenantStore) {}

  list(status?: TenantStatus): Promise<TenantRecord[]> {
    return this.store.list(status);
  }

  async get(id: string): Promise<TenantRecord> {
    const record = await this.store.get(id);
    if (!record) throw new RegistryError('NOT_FOUND', `Tenant ${id} not found`);
    return record;
  }

  /**
   * Create or update a store's config. New stores start as `draft`; status only changes via
   * publish/suspend. Tenant admins may edit their own existing store but not claim domains.
   */
  async upsert(principal: Principal, id: string, input: unknown, expectedVersion?: number): Promise<TenantRecord> {
    const existing = await this.store.get(id);
    const platformAdmin = hasRole(principal, Roles.PlatformAdmin);
    const ownTenantAdmin = hasRole(principal, Roles.TenantAdmin) && principal.tenantId === id;
    if (!platformAdmin && !(ownTenantAdmin && existing)) {
      throw new RegistryError('FORBIDDEN', existing ? 'Not allowed to edit this store' : 'Only platform admins can create stores');
    }
    if (expectedVersion !== undefined && expectedVersion !== (existing?.version ?? 0)) {
      throw new RegistryError('CONFLICT', `Version mismatch: expected ${expectedVersion}, current ${existing?.version ?? 0}`);
    }

    const config = this.validate({ ...(input as object), id, status: existing?.config.status ?? 'draft' });
    if (!platformAdmin && existing && !sameDomains(existing.config.domains, config.domains)) {
      throw new RegistryError('FORBIDDEN', 'Changing domains requires a platform admin');
    }
    await this.assertDomainsFree(config);

    const record: TenantRecord = { config, version: (existing?.version ?? 0) + 1, updatedAt: new Date(), updatedBy: principal.userId };
    await this.save(record, existing?.version ?? 0, existing ? TenancyEventTypes.Updated : TenancyEventTypes.Created);
    return record;
  }

  async setStatus(principal: Principal, id: string, status: TenantStatus): Promise<TenantRecord> {
    if (!hasRole(principal, Roles.PlatformAdmin)) throw new RegistryError('FORBIDDEN', 'Only platform admins can publish or suspend stores');
    const existing = await this.get(id);
    if (existing.config.status === status) return existing;
    const config = this.validate({ ...existing.config, status });
    if (status === 'live') await this.assertDomainsFree(config);
    const record: TenantRecord = { config, version: existing.version + 1, updatedAt: new Date(), updatedBy: principal.userId };
    await this.save(record, existing.version, status === 'live' ? TenancyEventTypes.Published : TenancyEventTypes.Suspended);
    return record;
  }

  /** One-time migration from config files: imports tenants that don't exist yet, keeping their status. */
  async importConfigs(configs: unknown[]): Promise<number> {
    let imported = 0;
    for (const raw of configs) {
      const config = this.validate(raw);
      if (await this.store.get(config.id)) continue;
      await this.assertDomainsFree(config);
      await this.save({ config, version: 1, updatedAt: new Date(), updatedBy: 'system:import' }, 0, TenancyEventTypes.Created);
      imported++;
    }
    return imported;
  }

  private validate(input: unknown): TenantConfig {
    try {
      return parseTenantConfig(input);
    } catch (err) {
      const lines = (err as Error).message.split('\n').slice(1).map((l) => l.trim());
      throw new RegistryError('VALIDATION_FAILED', 'Invalid tenant config', lines);
    }
  }

  private async assertDomainsFree(config: TenantConfig): Promise<void> {
    if (config.status === 'suspended') return;
    const mine = new Set(config.domains.map(normalizeHost));
    const clashes: string[] = [];
    for (const other of await this.store.list()) {
      if (other.config.id === config.id || other.config.status === 'suspended') continue;
      for (const d of other.config.domains) if (mine.has(normalizeHost(d))) clashes.push(`${d} (${other.config.id})`);
    }
    if (clashes.length) throw new RegistryError('CONFLICT', 'Domain already claimed by another store', clashes);
  }

  private async save(record: TenantRecord, expectedVersion: number, type: string): Promise<void> {
    const payload: TenantChangedPayload = {
      tenantId: record.config.id, version: record.version, status: record.config.status, config: record.config,
    };
    const event: DomainEvent<TenantChangedPayload> = {
      id: newId('evt'), type, tenantId: record.config.id, region: record.config.regions[0]!, aggregateId: record.config.id,
      occurredAt: record.updatedAt.toISOString(), version: record.version, payload,
    };
    try {
      await this.store.save(record, expectedVersion, [{ topic: Topics.TenancyTenant, event }]);
    } catch (err) {
      if (err instanceof VersionConflictError) throw new RegistryError('CONFLICT', 'Store was changed by someone else; reload and retry');
      throw err;
    }
  }
}

function sameDomains(a: string[], b: string[]): boolean {
  const norm = (xs: string[]) => [...new Set(xs.map(normalizeHost))].sort().join(',');
  return norm(a) === norm(b);
}
