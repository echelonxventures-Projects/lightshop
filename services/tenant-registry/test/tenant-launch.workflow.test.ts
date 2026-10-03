import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEM_PRINCIPAL, TenantRegistryService } from '../src/application/tenant-registry.service';
import { InMemoryTenantStore } from '../src/infrastructure/memory-tenant-store';
import { createLaunchActivities } from '../src/workflows/activities';

/**
 * Runs the real workflow on Temporal's time-skipping test server: hours of DNS retry backoff
 * complete in milliseconds, proving the durable retry policy without waiting.
 */
const WORKFLOWS = join(__dirname, '../src/workflows/tenant-launch.workflow.ts');

describe.skipIf(process.env.SKIP_TEMPORAL_TESTS === 'true')('tenantLaunchWorkflow (Temporal)', () => {
  let env: TestWorkflowEnvironment;

  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createTimeSkipping();
  }, 120_000);

  afterAll(() => env?.teardown());

  it('keeps retrying DNS verification durably until the TXT record appears, then publishes', async () => {
    const store = new InMemoryTenantStore();
    const registry = new TenantRegistryService(store);
    await registry.upsert(SYSTEM_PRINCIPAL, 'rose', {
      brand: { name: 'Rose' }, theme: { colorPrimary: '#AA2244' }, domains: ['shop.rose.example'], regions: ['us'],
      locales: ['en-US'], currencies: ['USD'], businessModels: ['d2c'], verticals: ['general'],
    });

    let lookups = 0;
    const resolver = async () => (++lookups >= 4 ? [['lightshop-verify=rose']] : []);
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue: 'test-tenant-launch',
      workflowsPath: WORKFLOWS,
      activities: createLaunchActivities(registry, resolver),
    });

    const result = await worker.runUntil(
      env.client.workflow.execute('tenantLaunchWorkflow', { taskQueue: 'test-tenant-launch', workflowId: 'launch-rose', args: ['rose'] }),
    );

    expect(result).toEqual({ tenantId: 'rose', version: 2 });
    expect(lookups).toBe(4);
    expect((await registry.get('rose')).config.status).toBe('live');
  }, 120_000);

  it('fails fast (non-retryable) for unknown tenants', async () => {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue: 'test-tenant-launch-2',
      workflowsPath: WORKFLOWS,
      activities: createLaunchActivities(new TenantRegistryService(new InMemoryTenantStore())),
    });
    await expect(
      worker.runUntil(env.client.workflow.execute('tenantLaunchWorkflow', { taskQueue: 'test-tenant-launch-2', workflowId: 'launch-ghost', args: ['ghost'] })),
    ).rejects.toThrow(/Workflow execution failed/);
  }, 120_000);
});
