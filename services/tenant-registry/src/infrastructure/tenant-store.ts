import { OutboxEntry, OutboxStore } from '@lightshop/outbox';
import { TenantRecord, TenantStatus } from '../domain/tenant-record';

export class VersionConflictError extends Error {}

/**
 * Persistence port. `save` is optimistic: it succeeds only if the stored version equals
 * `expectedVersion` (0 = must not exist), and writes the events in the same transaction.
 */
export interface TenantStore extends OutboxStore {
  list(status?: TenantStatus): Promise<TenantRecord[]>;
  get(id: string): Promise<TenantRecord | undefined>;
  save(record: TenantRecord, expectedVersion: number, events: OutboxEntry[]): Promise<void>;
}
