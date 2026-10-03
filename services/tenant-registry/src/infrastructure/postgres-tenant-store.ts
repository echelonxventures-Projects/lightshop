import { OUTBOX_MIGRATIONS, OutboxEntry, OutboxMessage, PostgresOutbox, appendToOutbox } from '@lightshop/outbox';
import { TenantConfig } from '@lightshop/tenancy';
import { Pool } from 'pg';
import { TenantRecord, TenantStatus } from '../domain/tenant-record';
import { TenantStore, VersionConflictError } from './tenant-store';

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS tenants (
     id         text        PRIMARY KEY,
     status     text        NOT NULL,
     config     jsonb       NOT NULL,
     version    integer     NOT NULL,
     updated_at timestamptz NOT NULL,
     updated_by text        NOT NULL
   )`,
  // Domains are globally unique across non-suspended tenants (also enforced in the application layer).
  `CREATE TABLE IF NOT EXISTS tenant_domains (
     domain    text PRIMARY KEY,
     tenant_id text NOT NULL REFERENCES tenants (id) ON DELETE CASCADE
   )`,
  ...OUTBOX_MIGRATIONS,
];

interface Row { config: TenantConfig; version: number; updated_at: Date; updated_by: string }

export class PostgresTenantStore implements TenantStore {
  private readonly outbox: PostgresOutbox;

  constructor(private readonly pool: Pool) {
    this.outbox = new PostgresOutbox(pool);
  }

  static async connect(url: string): Promise<PostgresTenantStore> {
    const pool = new Pool({ connectionString: url, max: 5 });
    for (const sql of MIGRATIONS) await pool.query(sql);
    return new PostgresTenantStore(pool);
  }

  async list(status?: TenantStatus): Promise<TenantRecord[]> {
    const { rows } = status
      ? await this.pool.query<Row>(`SELECT config, version, updated_at, updated_by FROM tenants WHERE status=$1 ORDER BY id`, [status])
      : await this.pool.query<Row>(`SELECT config, version, updated_at, updated_by FROM tenants ORDER BY id`);
    return rows.map(toRecord);
  }

  async get(id: string): Promise<TenantRecord | undefined> {
    const { rows } = await this.pool.query<Row>(`SELECT config, version, updated_at, updated_by FROM tenants WHERE id=$1`, [id]);
    return rows[0] && toRecord(rows[0]);
  }

  async save(record: TenantRecord, expectedVersion: number, events: OutboxEntry[]): Promise<void> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const { config } = record;
      const result =
        expectedVersion === 0
          ? await c.query(
              `INSERT INTO tenants (id,status,config,version,updated_at,updated_by) VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT (id) DO NOTHING`,
              [config.id, config.status, config, record.version, record.updatedAt, record.updatedBy],
            )
          : await c.query(
              `UPDATE tenants SET status=$2, config=$3, version=$4, updated_at=$5, updated_by=$6 WHERE id=$1 AND version=$7`,
              [config.id, config.status, config, record.version, record.updatedAt, record.updatedBy, expectedVersion],
            );
      if (result.rowCount !== 1) throw new VersionConflictError(`tenant ${config.id} changed concurrently`);
      await c.query(`DELETE FROM tenant_domains WHERE tenant_id=$1`, [config.id]);
      if (config.status !== 'suspended') {
        for (const d of config.domains) {
          await c.query(`INSERT INTO tenant_domains (domain, tenant_id) VALUES ($1,$2)`, [d.toLowerCase(), config.id]);
        }
      }
      await appendToOutbox(c, events);
      await c.query('COMMIT');
    } catch (err) {
      await c.query('ROLLBACK');
      throw err;
    } finally {
      c.release();
    }
  }

  drain(limit: number, publish: (m: OutboxMessage[]) => Promise<void>) {
    return this.outbox.drain(limit, publish);
  }

  pendingCount() {
    return this.outbox.pendingCount();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function toRecord(r: Row): TenantRecord {
  return { config: r.config, version: r.version, updatedAt: r.updated_at, updatedBy: r.updated_by };
}
