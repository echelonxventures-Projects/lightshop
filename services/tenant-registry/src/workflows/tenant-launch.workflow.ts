// Temporal workflow code: deterministic, imports only @temporalio/workflow and types.
import { ApplicationFailure, defineQuery, proxyActivities, setHandler } from '@temporalio/workflow';
import type { LaunchActivities } from './activities';

export interface LaunchProgress {
  step: 'validating' | 'verifying-domains' | 'publishing' | 'live';
  verifiedDomains: string[];
}

export const launchProgressQuery = defineQuery<LaunchProgress>('progress');

const quick = proxyActivities<Pick<LaunchActivities, 'validateTenant' | 'publishTenant'>>({
  startToCloseTimeout: '30 seconds',
  // Business-rule failures (unknown/suspended tenant, domain conflict) won't fix themselves: fail fast.
  retry: { maximumAttempts: 5, nonRetryableErrorTypes: ['RegistryError'] },
});

// DNS changes take minutes to hours: keep retrying with backoff for up to ~3 days, durably.
const dns = proxyActivities<Pick<LaunchActivities, 'verifyDomain'>>({
  startToCloseTimeout: '20 seconds',
  retry: { initialInterval: '30 seconds', backoffCoefficient: 2, maximumInterval: '30 minutes', maximumAttempts: 150 },
});

/** Zero-code store launch: validate config → prove domain ownership → publish (go live). */
export async function tenantLaunchWorkflow(tenantId: string): Promise<{ tenantId: string; version: number }> {
  const progress: LaunchProgress = { step: 'validating', verifiedDomains: [] };
  setHandler(launchProgressQuery, () => progress);

  let domains: string[];
  try {
    ({ domains } = await quick.validateTenant(tenantId));
  } catch (err) {
    throw ApplicationFailure.nonRetryable(`Tenant ${tenantId} cannot be launched: ${(err as Error).message}`);
  }

  progress.step = 'verifying-domains';
  for (const domain of domains) {
    await dns.verifyDomain(tenantId, domain);
    progress.verifiedDomains.push(domain);
  }

  progress.step = 'publishing';
  const { version } = await quick.publishTenant(tenantId);
  progress.step = 'live';
  return { tenantId, version };
}
