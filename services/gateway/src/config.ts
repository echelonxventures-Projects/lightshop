import { AuthConfig } from '@lightshop/auth';
import { GRAPHQL_LIMITS } from '@lightshop/graphql-security';
import { join } from 'node:path';

export interface Subgraph {
  name: string;
  url: string;
}

export interface GatewayConfig {
  port: number;
  production: boolean;
  /** SUBGRAPHS="catalog=http://catalog/graphql,orders=http://orders/graphql" */
  subgraphs: Subgraph[];
  auth: AuthConfig;
  /** Sent to subgraphs (they trust x-tenant-id only with it) and accepted from trusted BFFs (storefront server). */
  gatewaySecret?: string;
  tenantsUrl?: string;
  tenantsDir: string;
  tenantsRefreshMs: number;
  /** Requests per minute per (tenant, client IP). */
  rateLimitPerMinute: number;
  /** Honour X-Forwarded-For / X-Forwarded-Host (only behind a trusted load balancer). */
  trustProxy: boolean;
  maxDepth: number;
  maxTokens: number;
  introspection: boolean;
  supergraphRefreshMs: number;
}

export function parseSubgraphs(value: string): Subgraph[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, url] = pair.split('=');
      if (!name || !url) throw new Error(`Invalid SUBGRAPHS entry "${pair}" (expected name=url)`);
      return { name: name.trim(), url: url.trim() };
    });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const production = env.NODE_ENV === 'production';
  const config: GatewayConfig = {
    port: Number(env.GATEWAY_PORT ?? 4000),
    production,
    subgraphs: parseSubgraphs(env.SUBGRAPHS ?? 'catalog=http://localhost:4001/graphql'),
    auth: env.OIDC_ISSUER
      ? { mode: 'oidc', issuer: env.OIDC_ISSUER, audience: env.OIDC_AUDIENCE ?? 'lightshop', jwksUrl: env.OIDC_JWKS_URL || undefined }
      : { mode: 'dev', secret: env.DEV_AUTH_SECRET ?? 'lightshop-local-dev-secret' },
    gatewaySecret: env.GATEWAY_SHARED_SECRET || undefined,
    tenantsUrl: env.TENANTS_URL || undefined,
    tenantsDir: env.TENANTS_DIR ?? join(__dirname, '..', '..', '..', 'config', 'tenants'),
    tenantsRefreshMs: Number(env.TENANTS_REFRESH_MS ?? 15_000),
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE ?? 600),
    trustProxy: env.TRUST_PROXY === 'true',
    maxDepth: Number(env.GRAPHQL_MAX_DEPTH ?? GRAPHQL_LIMITS.maxDepth),
    maxTokens: Number(env.GRAPHQL_MAX_TOKENS ?? GRAPHQL_LIMITS.maxTokens),
    introspection: env.GRAPHQL_INTROSPECTION ? env.GRAPHQL_INTROSPECTION === 'true' : !production,
    supergraphRefreshMs: Number(env.SUPERGRAPH_REFRESH_MS ?? 30_000),
  };
  if (production) {
    const problems: string[] = [];
    if (config.auth.mode !== 'oidc') problems.push('OIDC_ISSUER is required');
    if (!config.gatewaySecret || config.gatewaySecret.length < 32) problems.push('GATEWAY_SHARED_SECRET of at least 32 characters is required');
    if (problems.length) throw new Error(`Unsafe production configuration:\n  - ${problems.join('\n  - ')}`);
  }
  return config;
}
