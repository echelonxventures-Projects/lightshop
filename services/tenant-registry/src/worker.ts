import { telemetry } from './telemetry';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TenantRegistryService } from './application/tenant-registry.service';
import { loadConfig } from './config';
import { createTenantStore } from './stores';
import { createLaunchActivities } from './workflows/activities';
import { TENANT_TASK_QUEUE } from './workflows/launch-runner';

/** Temporal worker for tenant workflows. Deploy as its own process/Deployment; scale independently. */
async function run(): Promise<void> {
  const config = loadConfig();
  if (!config.temporalAddress) throw new Error('TEMPORAL_ADDRESS is required to run the worker');
  const store = await createTenantStore(config);
  const connection = await NativeConnection.connect({ address: config.temporalAddress });
  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: TENANT_TASK_QUEUE,
    workflowsPath: require.resolve('./workflows/tenant-launch.workflow'),
    activities: createLaunchActivities(new TenantRegistryService(store)),
  });
  console.log(`tenant-registry worker polling "${TENANT_TASK_QUEUE}" on ${config.temporalAddress} (telemetry: ${telemetry.enabled ? 'on' : 'off'})`);
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
