import { join } from 'node:path';

export interface CatalogConfig {
  port: number;
  /** Unset → in-memory repository (zero-dependency dev mode). */
  databaseUrl?: string;
  eventBus: 'memory' | 'kafka';
  kafkaBrokers: string[];
  tenantsDir: string;
  seedDemo: boolean;
  outboxIntervalMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CatalogConfig {
  const databaseUrl = env.CATALOG_DATABASE_URL || undefined;
  return {
    port: Number(env.CATALOG_PORT ?? 4001),
    databaseUrl,
    eventBus: env.EVENT_BUS === 'kafka' ? 'kafka' : 'memory',
    kafkaBrokers: (env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    // Same depth from src/ and dist/: services/catalog/{src,dist} → repo root.
    tenantsDir: env.TENANTS_DIR ?? join(__dirname, '..', '..', '..', 'config', 'tenants'),
    seedDemo: (env.SEED_DEMO ?? 'true') === 'true',
    outboxIntervalMs: Number(env.OUTBOX_INTERVAL_MS ?? 500),
  };
}
