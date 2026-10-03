import { InMemoryOutbox, OutboxEntry, OutboxMessage, OutboxStore } from '@lightshop/outbox';
import { Product } from '../domain/product';
import { Page, PageRequest, ProductRepository, decodeCursor } from './product-repository';

/** Zero-dependency adapter: tests and `pnpm dev:catalog` without Docker. */
export class InMemoryProductRepository implements ProductRepository, OutboxStore {
  private readonly products = new Map<string, Product>();
  private readonly outbox = new InMemoryOutbox();

  async save(product: Product, events: OutboxEntry[]): Promise<void> {
    this.products.set(`${product.tenantId}:${product.id}`, Product.rehydrate(product.toProps()));
    this.outbox.append(events);
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

  drain(limit: number, publish: (m: OutboxMessage[]) => Promise<void>): Promise<number> {
    return this.outbox.drain(limit, publish);
  }

  pendingCount(): Promise<number> {
    return this.outbox.pendingCount();
  }
}
