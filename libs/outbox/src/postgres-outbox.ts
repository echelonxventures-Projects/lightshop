import { newId } from '@lightshop/domain-kernel';
import { Pool, PoolClient } from 'pg';
import { OutboxEntry, OutboxMessage, OutboxStore } from './types';

/** Add to a service's migrations. One outbox table per service database. */
export const OUTBOX_MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS outbox (
     id           text        PRIMARY KEY,
     topic        text        NOT NULL,
     payload      jsonb       NOT NULL,
     created_at   timestamptz NOT NULL DEFAULT now(),
     published_at timestamptz
   )`,
  `CREATE INDEX IF NOT EXISTS outbox_pending ON outbox (created_at) WHERE published_at IS NULL`,
];

/** Call inside the same transaction that writes the aggregate. */
export async function appendToOutbox(client: PoolClient, entries: OutboxEntry[]): Promise<void> {
  for (const e of entries) {
    await client.query(`INSERT INTO outbox (id, topic, payload) VALUES ($1,$2,$3)`, [newId('obx'), e.topic, e.event]);
  }
}

export class PostgresOutbox implements OutboxStore {
  constructor(private readonly pool: Pool) {}

  async drain(limit: number, publish: (m: OutboxMessage[]) => Promise<void>): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // SKIP LOCKED lets several relay replicas drain concurrently without double-publishing.
      const { rows } = await client.query<{ id: string; topic: string; payload: OutboxMessage['event'] }>(
        `SELECT id, topic, payload FROM outbox WHERE published_at IS NULL
         ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [limit],
      );
      if (rows.length > 0) {
        await publish(rows.map((r) => ({ id: r.id, topic: r.topic, event: r.payload })));
        await client.query(`UPDATE outbox SET published_at = now() WHERE id = ANY($1)`, [rows.map((r) => r.id)]);
      }
      await client.query('COMMIT');
      return rows.length;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async pendingCount(): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>(`SELECT count(*) AS n FROM outbox WHERE published_at IS NULL`);
    return Number(rows[0]?.n ?? 0);
  }
}
