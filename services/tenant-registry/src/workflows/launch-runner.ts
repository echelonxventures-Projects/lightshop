import { Client, Connection } from '@temporalio/client';
import { RegistryError } from '../application/errors';
import { LaunchActivities } from './activities';

export const TENANT_TASK_QUEUE = 'tenant-registry';

export interface LaunchHandle {
  workflowId: string;
  mode: 'temporal' | 'inline';
  /** Inline runs finish synchronously; Temporal runs are tracked via status(). */
  result?: { tenantId: string; version: number };
}

/** Port: how long-running launches execute. Temporal in real environments, inline for zero-dependency dev. */
export interface LaunchRunner {
  start(tenantId: string): Promise<LaunchHandle>;
  status(workflowId: string): Promise<{ status: string; progress?: unknown }>;
  close(): Promise<void>;
}

export class TemporalLaunchRunner implements LaunchRunner {
  private constructor(
    private readonly client: Client,
    private readonly connection: Connection,
  ) {}

  static async connect(address: string, namespace = 'default'): Promise<TemporalLaunchRunner> {
    const connection = await Connection.connect({ address });
    return new TemporalLaunchRunner(new Client({ connection, namespace }), connection);
  }

  async start(tenantId: string): Promise<LaunchHandle> {
    // One launch per tenant at a time: the workflow id is deterministic.
    const workflowId = `tenant-launch-${tenantId}`;
    await this.client.workflow.start('tenantLaunchWorkflow', {
      taskQueue: TENANT_TASK_QUEUE,
      workflowId,
      args: [tenantId],
      workflowIdConflictPolicy: 'USE_EXISTING',
    });
    return { workflowId, mode: 'temporal' };
  }

  async status(workflowId: string) {
    const handle = this.client.workflow.getHandle(workflowId);
    const desc = await handle.describe();
    const progress = desc.status.name === 'RUNNING' || desc.status.name === 'COMPLETED' ? await handle.query('progress').catch(() => undefined) : undefined;
    return { status: desc.status.name, progress };
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}

/** Runs the same steps synchronously without retries. Development only. */
export class InlineLaunchRunner implements LaunchRunner {
  private readonly results = new Map<string, { status: string; progress?: unknown }>();

  constructor(private readonly activities: LaunchActivities) {}

  async start(tenantId: string): Promise<LaunchHandle> {
    const workflowId = `tenant-launch-${tenantId}`;
    try {
      const { domains } = await this.activities.validateTenant(tenantId);
      for (const d of domains) await this.activities.verifyDomain(tenantId, d);
      const { version } = await this.activities.publishTenant(tenantId);
      this.results.set(workflowId, { status: 'COMPLETED', progress: { step: 'live', verifiedDomains: domains } });
      return { workflowId, mode: 'inline', result: { tenantId, version } };
    } catch (err) {
      this.results.set(workflowId, { status: 'FAILED', progress: { error: (err as Error).message } });
      if (err instanceof RegistryError) throw err;
      throw new RegistryError('CONFLICT', `Launch failed: ${(err as Error).message}`);
    }
  }

  async status(workflowId: string) {
    return this.results.get(workflowId) ?? { status: 'NOT_FOUND' };
  }

  async close(): Promise<void> {}
}
