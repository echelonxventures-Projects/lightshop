import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('defaults to safe, zero-dependency dev settings', () => {
    const c = loadConfig({});
    expect(c.seedDemo).toBe(false);
    expect(c.auth.mode).toBe('dev');
    expect(c.introspection).toBe(true);
    expect(c.gatewaySecret).toBeUndefined();
  });

  it('refuses an unsafe production configuration and lists every problem', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SEED_DEMO: 'true' })).toThrow(
      /OIDC_ISSUER[\s\S]*GATEWAY_SHARED_SECRET[\s\S]*CATALOG_DATABASE_URL[\s\S]*SEED_DEMO/,
    );
  });

  it('accepts a complete production configuration with introspection off', () => {
    const c = loadConfig({
      NODE_ENV: 'production',
      OIDC_ISSUER: 'https://id.example/realms/acme',
      GATEWAY_SHARED_SECRET: 'x'.repeat(32),
      CATALOG_DATABASE_URL: 'postgres://db/catalog',
    });
    expect(c.auth).toEqual({ mode: 'oidc', issuer: 'https://id.example/realms/acme', audience: 'lightshop', jwksUrl: undefined });
    expect(c.introspection).toBe(false);
  });
});
