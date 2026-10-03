import { join } from 'node:path';

export type AuthConfig =
  | { mode: 'oidc'; issuer: string; audience: string; jwksUrl?: string }
  | { mode: 'dev'; secret: string };

export interface CatalogConfig {
  port: number;
  production: boolean;
  /** Unset → in-memory repository (zero-dependency dev mode). */
  databaseUrl?: string;
  eventBus: 'memory' | 'kafka';
  kafkaBrokers: string[];
  tenantsDir: string;
  /** Loads demo products. Off unless explicitly enabled. */
  seedDemo: boolean;
  outboxIntervalMs: number;
  auth: AuthConfig;
  /**
   * Shared secret the gateway/BFF presents. Identity headers (x-tenant-id …) are honoured only from
   * callers that present it; everyone else is resolved by Host. Unset is allowed outside production.
   */
  gatewaySecret?: string;
  maxQueryDepth: number;
  maxQueryTokens: number;
  introspection: boolean;
}

const DEV_AUTH_SECRET = 'lightshop-local-dev-secret';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CatalogConfig {
  const production = env.NODE_ENV === 'production';
  const auth: AuthConfig = env.OIDC_ISSUER
    ? { mode: 'oidc', issuer: env.OIDC_ISSUER, audience: env.OIDC_AUDIENCE ?? 'lightshop', jwksUrl: env.OIDC_JWKS_URL || undefined }
    : { mode: 'dev', secret: env.DEV_AUTH_SECRET ?? DEV_AUTH_SECRET };

  const config: CatalogConfig = {
    port: Number(env.CATALOG_PORT ?? 4001),
    production,
    databaseUrl: env.CATALOG_DATABASE_URL || undefined,
    eventBus: env.EVENT_BUS === 'kafka' ? 'kafka' : 'memory',
    kafkaBrokers: (env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    // Same depth from src/ and dist/: services/catalog/{src,dist} → repo root.
    tenantsDir: env.TENANTS_DIR ?? join(__dirname, '..', '..', '..', 'config', 'tenants'),
    seedDemo: env.SEED_DEMO === 'true',
    outboxIntervalMs: Number(env.OUTBOX_INTERVAL_MS ?? 500),
    auth,
    gatewaySecret: env.GATEWAY_SHARED_SECRET || undefined,
    maxQueryDepth: Number(env.GRAPHQL_MAX_DEPTH ?? 12),
    maxQueryTokens: Number(env.GRAPHQL_MAX_TOKENS ?? 5000),
    introspection: env.GRAPHQL_INTROSPECTION ? env.GRAPHQL_INTROSPECTION === 'true' : !production,
  };

  if (production) assertProductionSafe(config);
  return config;
}

/** Fail fast instead of booting an insecure production instance. */
function assertProductionSafe(c: CatalogConfig): void {
  const problems: string[] = [];
  if (c.auth.mode !== 'oidc') problems.push('OIDC_ISSUER is required (dev tokens are not allowed in production)');
  if (!c.gatewaySecret || c.gatewaySecret.length < 32) problems.push('GATEWAY_SHARED_SECRET of at least 32 characters is required');
  if (!c.databaseUrl) problems.push('CATALOG_DATABASE_URL is required (in-memory storage is not allowed in production)');
  if (c.seedDemo) problems.push('SEED_DEMO must not be enabled in production');
  if (problems.length) throw new Error(`Unsafe production configuration:\n  - ${problems.join('\n  - ')}`);
}
