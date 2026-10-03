import { OutboxEntry } from '@lightshop/outbox';
import { Product } from '../domain/product';

export interface PageRequest {
  vertical?: string;
  first: number;
  after?: string;
}

export interface Page<T> {
  items: T[];
  hasNextPage: boolean;
}

/**
 * Persistence port. `save` stores the aggregate AND its events in one transaction
 * (transactional outbox), so an event is published if and only if the change committed.
 * Every read is tenant-scoped; there is no method that can read across tenants.
 */
export interface ProductRepository {
  save(product: Product, events: OutboxEntry[]): Promise<void>;
  findById(tenantId: string, id: string): Promise<Product | undefined>;
  list(tenantId: string, page: PageRequest): Promise<Page<Product>>;
  count(tenantId: string): Promise<number>;
}

export function encodeCursor(p: Product): string {
  return Buffer.from(`${p.createdAt.toISOString()}|${p.id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) throw new Error('Invalid cursor');
  return { createdAt, id };
}
