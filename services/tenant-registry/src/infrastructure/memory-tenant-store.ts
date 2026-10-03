import { InMemoryOutbox, OutboxEntry, OutboxMessage } from '@lightshop/outbox';
import { TenantRecord, TenantStatus } from '../domain/tenant-record';
import { TenantStore, VersionConflictError } from './tenant-store';

export class InMemoryTenantStore implements TenantStore {
  private readonly records = new Map<string, TenantRecord>();
  private readonly outbox = new InMemoryOutbox();

  async list(status?: TenantStatus): Promise<TenantRecord[]> {
    return [...this.records.values()].filter((r) => !status || r.config.status === status).map((r) => structuredClone(r));
  }

  async get(id: string): Promise<TenantRecord | undefined> {
    const r = this.records.get(id);
    return r && structuredClone(r);
  }

  async save(record: TenantRecord, expectedVersion: number, events: OutboxEntry[]): Promise<void> {
    const current = this.records.get(record.config.id)?.version ?? 0;
    if (current !== expectedVersion) throw new VersionConflictError(`expected version ${expectedVersion}, found ${current}`);
    this.records.set(record.config.id, structuredClone(record));
    this.outbox.append(events);
  }

  drain(limit: number, publish: (m: OutboxMessage[]) => Promise<void>) {
    return this.outbox.drain(limit, publish);
  }

  pendingCount() {
    return this.outbox.pendingCount();
  }
}
