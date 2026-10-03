import { Money } from '@lightshop/domain-kernel';
import { OUTBOX_MIGRATIONS, OutboxEntry, OutboxMessage, OutboxStore, PostgresOutbox, appendToOutbox } from '@lightshop/outbox';
import { Pool, PoolClient } from 'pg';
import { Offer, Product, ProductStatus } from '../domain/product';
import { Page, PageRequest, ProductRepository, decodeCursor } from './product-repository';

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS products (
     tenant_id     text        NOT NULL,
     id            text        NOT NULL,
     region        text        NOT NULL,
     vertical      text        NOT NULL,
     titles        jsonb       NOT NULL,
     description   text,
     category_path text[]      NOT NULL DEFAULT '{}',
     attributes    jsonb       NOT NULL DEFAULT '{}',
     status        text        NOT NULL,
     version       integer     NOT NULL,
     created_at    timestamptz NOT NULL,
     PRIMARY KEY (tenant_id, id)
   )`,
  `CREATE INDEX IF NOT EXISTS products_listing ON products (tenant_id, created_at DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS products_vertical ON products (tenant_id, vertical, created_at DESC, id DESC)`,
  `CREATE TABLE IF NOT EXISTS offers (
     tenant_id    text    NOT NULL,
     id           text    NOT NULL,
     product_id   text    NOT NULL,
     seller_id    text    NOT NULL,
     sku          text    NOT NULL,
     amount_minor bigint  NOT NULL,
     currency     char(3) NOT NULL,
     stock        integer NOT NULL CHECK (stock >= 0),
     condition    text    NOT NULL,
     moq          integer NOT NULL CHECK (moq >= 1),
     PRIMARY KEY (tenant_id, id),
     UNIQUE (tenant_id, product_id, seller_id, sku),
     FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id) ON DELETE CASCADE
   )`,
  ...OUTBOX_MIGRATIONS,
];

interface ProductRow {
  tenant_id: string; id: string; region: string; vertical: string; titles: Record<string, string>;
  description: string | null; category_path: string[]; attributes: Record<string, unknown>;
  status: ProductStatus; version: number; created_at: Date;
}

interface OfferRow {
  id: string; product_id: string; seller_id: string; sku: string; amount_minor: string;
  currency: string; stock: number; condition: Offer['condition']; moq: number;
}

export class PostgresProductRepository implements ProductRepository, OutboxStore {
  private readonly outbox: PostgresOutbox;

  constructor(private readonly pool: Pool) {
    this.outbox = new PostgresOutbox(pool);
  }

  static async connect(url: string): Promise<PostgresProductRepository> {
    const pool = new Pool({ connectionString: url, max: 10 });
    for (const sql of MIGRATIONS) await pool.query(sql);
    return new PostgresProductRepository(pool);
  }

  async save(product: Product, events: OutboxEntry[]): Promise<void> {
    const p = product.toProps();
    await this.tx(async (c) => {
      await c.query(
        `INSERT INTO products (tenant_id,id,region,vertical,titles,description,category_path,attributes,status,version,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (tenant_id,id) DO UPDATE SET titles=$5, description=$6, category_path=$7,
           attributes=$8, status=$9, version=$10
         WHERE products.version < $10`,
        [p.tenantId, p.id, p.region, p.vertical, p.titles, p.description ?? null, p.categoryPath,
         p.attributes, p.status, p.version, p.createdAt],
      );
      for (const o of p.offers) {
        await c.query(
          `INSERT INTO offers (tenant_id,id,product_id,seller_id,sku,amount_minor,currency,stock,condition,moq)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (tenant_id,id) DO UPDATE SET amount_minor=$6, stock=$8, condition=$9, moq=$10`,
          [p.tenantId, o.id, p.id, o.sellerId, o.sku, o.price.amountMinor, o.price.currency, o.stock, o.condition, o.moq],
        );
      }
      await appendToOutbox(c, events);
    });
  }

  async findById(tenantId: string, id: string): Promise<Product | undefined> {
    const { rows } = await this.pool.query<ProductRow>(`SELECT * FROM products WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
    return (await this.hydrate(tenantId, rows))[0];
  }

  async list(tenantId: string, page: PageRequest): Promise<Page<Product>> {
    const params: unknown[] = [tenantId];
    let where = 'tenant_id=$1';
    if (page.vertical) {
      params.push(page.vertical);
      where += ` AND vertical=$${params.length}`;
    }
    if (page.after) {
      const c = decodeCursor(page.after);
      params.push(c.createdAt, c.id);
      where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
    }
    params.push(page.first + 1);
    const { rows } = await this.pool.query<ProductRow>(
      `SELECT * FROM products WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    const items = await this.hydrate(tenantId, rows.slice(0, page.first));
    return { items, hasNextPage: rows.length > page.first };
  }

  async count(tenantId: string): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>(`SELECT count(*) AS n FROM products WHERE tenant_id=$1`, [tenantId]);
    return Number(rows[0]?.n ?? 0);
  }

  drain(limit: number, publish: (m: OutboxMessage[]) => Promise<void>): Promise<number> {
    return this.outbox.drain(limit, publish);
  }

  pendingCount(): Promise<number> {
    return this.outbox.pendingCount();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async hydrate(tenantId: string, rows: ProductRow[]): Promise<Product[]> {
    if (rows.length === 0) return [];
    const { rows: offerRows } = await this.pool.query<OfferRow>(
      `SELECT * FROM offers WHERE tenant_id=$1 AND product_id = ANY($2) ORDER BY id`,
      [tenantId, rows.map((r) => r.id)],
    );
    return rows.map((r) =>
      Product.rehydrate({
        id: r.id, tenantId: r.tenant_id, region: r.region, vertical: r.vertical, titles: r.titles,
        description: r.description ?? undefined, categoryPath: r.category_path, attributes: r.attributes,
        status: r.status, version: r.version, createdAt: r.created_at,
        offers: offerRows.filter((o) => o.product_id === r.id).map((o) => ({
          id: o.id, sellerId: o.seller_id, sku: o.sku, price: Money.ofMinor(Number(o.amount_minor), o.currency),
          stock: o.stock, condition: o.condition, moq: o.moq,
        })),
      }),
    );
  }

  private async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
