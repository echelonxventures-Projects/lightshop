import { AuthConfig } from '@lightshop/auth';

export interface RegistryConfig {
  port: number;
  production: boolean;
  databaseUrl?: string;
  eventBus: 'memory' | 'kafka';
  kafkaBrokers: string[];
  auth: AuthConfig;
  /** Internal callers (catalog, storefront, gateway) present this to read tenant configs. */
  gatewaySecret?: string;
  /** Unset → launches run inline (no Temporal needed locally). */
  temporalAddress?: string;
  temporalNamespace: string;
  /** Import tenants from a directory of JSON files at startup (migration from file-based configs). */
  seedTenantsDir?: string;
  outboxIntervalMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RegistryConfig {
  const production = env.NODE_ENV === 'production';
  const config: RegistryConfig = {
    port: Number(env.TENANT_REGISTRY_PORT ?? 4002),
    production,
    databaseUrl: env.TENANT_REGISTRY_DATABASE_URL || undefined,
    eventBus: env.EVENT_BUS === 'kafka' ? 'kafka' : 'memory',
    kafkaBrokers: (env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    auth: env.OIDC_ISSUER
      ? { mode: 'oidc', issuer: env.OIDC_ISSUER, audience: env.OIDC_AUDIENCE ?? 'lightshop', jwksUrl: env.OIDC_JWKS_URL || undefined }
      : { mode: 'dev', secret: env.DEV_AUTH_SECRET ?? 'lightshop-local-dev-secret' },
    gatewaySecret: env.GATEWAY_SHARED_SECRET || undefined,
    temporalAddress: env.TEMPORAL_ADDRESS || undefined,
    temporalNamespace: env.TEMPORAL_NAMESPACE ?? 'default',
    seedTenantsDir: env.SEED_TENANTS_DIR || undefined,
    outboxIntervalMs: Number(env.OUTBOX_INTERVAL_MS ?? 500),
  };
  if (production) {
    const problems: string[] = [];
    if (config.auth.mode !== 'oidc') problems.push('OIDC_ISSUER is required');
    if (!config.gatewaySecret || config.gatewaySecret.length < 32) problems.push('GATEWAY_SHARED_SECRET of at least 32 characters is required');
    if (!config.databaseUrl) problems.push('TENANT_REGISTRY_DATABASE_URL is required');
    if (!config.temporalAddress) problems.push('TEMPORAL_ADDRESS is required (inline launches are for development only)');
    if (problems.length) throw new Error(`Unsafe production configuration:\n  - ${problems.join('\n  - ')}`);
  }
  return config;
}
