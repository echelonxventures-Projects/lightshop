import { resolveTxt } from 'node:dns/promises';
import { RegistryError } from '../application/errors';
import { SYSTEM_PRINCIPAL, TenantRegistryService } from '../application/tenant-registry.service';

export interface LaunchActivities {
  validateTenant(tenantId: string): Promise<{ domains: string[] }>;
  verifyDomain(tenantId: string, domain: string): Promise<void>;
  publishTenant(tenantId: string): Promise<{ version: number }>;
}

export class DomainNotVerifiedError extends Error {}

/** Domains that can never be DNS-verified and are trusted for development. */
const LOCAL_DOMAIN = /(^localhost$|\.localhost$|\.test$|^127\.0\.0\.1$)/;

export type TxtResolver = (name: string) => Promise<string[][]>;

/**
 * Launch steps as plain async functions: Temporal runs them with durable retries; the inline
 * runner calls them directly. DNS ownership proof is a TXT record, which every DNS provider supports.
 */
export function createLaunchActivities(registry: TenantRegistryService, resolver: TxtResolver = resolveTxt): LaunchActivities {
  return {
    async validateTenant(tenantId) {
      const record = await registry.get(tenantId);
      if (record.config.status === 'suspended') throw new RegistryError('CONFLICT', `Tenant ${tenantId} is suspended`);
      return { domains: record.config.domains };
    },

    async verifyDomain(tenantId, domain) {
      if (LOCAL_DOMAIN.test(domain)) return;
      const expected = `lightshop-verify=${tenantId}`;
      let records: string[][] = [];
      try {
        records = await resolver(`_lightshop-challenge.${domain}`);
      } catch {
        /* NXDOMAIN etc. → not verified yet */
      }
      if (!records.some((chunks) => chunks.join('') === expected)) {
        throw new DomainNotVerifiedError(`Add TXT record _lightshop-challenge.${domain} = "${expected}"`);
      }
    },

    async publishTenant(tenantId) {
      const record = await registry.setStatus(SYSTEM_PRINCIPAL, tenantId, 'live');
      return { version: record.version };
    },
  };
}
