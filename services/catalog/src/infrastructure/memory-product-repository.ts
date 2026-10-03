import { newId } from '@lightshop/domain-kernel';
import { Product } from '../domain/product';
import {
  OutboxMessage, OutboxStore, Page, PageRequest, ProductRepository, decodeCursor,
} from './product-repository';

/** Zero-dependency adapter: tests and `pnpm dev:catalog` without Docker. */
export class InMemoryProductRepository implements ProductRepository, OutboxStore {
  private readonly products = new Map<string, Product>();
  private readonly outbox: Array<OutboxMessage & { publishedAt?: Date }> = [];

  async save(product: Product, events: Parameters<ProductRepository['save']>[1]): Promise<void> {
    this.products.set(`${product.tenantId}:${product.id}`, Product.rehydrate(product.toProps()));
    for (const e of events) this.outbox.push({ id: newId('obx'), ...e });
  }

  async findById(tenantId: string, id: string): Promise<Product | undefined> {
    const p = this.products.get(`${tenantId}:${id}`);
    return p && Product.rehydrate(p.toProps());
  }

  async list(tenantId: string, page: PageRequest): Promise<Page<Product>> {
    const after = page.after ? decodeCursor(page.after) : undefined;
    const sorted = [...this.products.values()]
      .filter((p) => p.tenantId === tenantId && (!page.vertical || p.vertical === page.vertical))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
      .filter((p) =>
        !after ||
        p.createdAt.getTime() < after.createdAt.getTime() ||
        (p.createdAt.getTime() === after.createdAt.getTime() && p.id.localeCompare(after.id) < 0),
      );
    return { items: sorted.slice(0, page.first), hasNextPage: sorted.length > page.first };
  }

  async count(tenantId: string): Promise<number> {
    return [...this.products.values()].filter((p) => p.tenantId === tenantId).length;
  }

  async drain(limit: number, publish: (m: OutboxMessage[]) => Promise<void>): Promise<number> {
    const batch = this.outbox.filter((m) => !m.publishedAt).slice(0, limit);
    if (batch.length === 0) return 0;
    await publish(batch.map(({ id, topic, event }) => ({ id, topic, event })));
    const now = new Date();
    batch.forEach((m) => (m.publishedAt = now));
    return batch.length;
  }

  async pendingCount(): Promise<number> {
    return this.outbox.filter((m) => !m.publishedAt).length;
  }
}
