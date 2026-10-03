import { EventBus } from '@lightshop/adapters';
import { metrics } from '@lightshop/observability';
import { Logger } from '@nestjs/common';
import { OutboxStore } from './product-repository';

/** Polls the outbox and publishes to the event bus. At-least-once: consumers must be idempotent on event.id. */
export class OutboxRelay {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly logger = new Logger(OutboxRelay.name);
  private pending = 0;
  private readonly meter = metrics.getMeter('lightshop.outbox');
  private readonly published = this.meter.createCounter('lightshop.outbox.published', {
    description: 'Domain events published from the transactional outbox',
  });
  private readonly failures = this.meter.createCounter('lightshop.outbox.publish_failures', {
    description: 'Outbox drain attempts that failed and will be retried',
  });

  constructor(
    private readonly store: OutboxStore,
    private readonly bus: EventBus,
    private readonly intervalMs = 500,
    private readonly batchSize = 100,
  ) {}

  start(): void {
    this.meter
      .createObservableGauge('lightshop.outbox.pending', { description: 'Unpublished events waiting in the outbox' })
      .addCallback((r) => r.observe(this.pending));
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
  }

  /** Drains until empty. Exposed for tests. */
  async flush(): Promise<number> {
    let total = 0;
    for (let n = -1; n !== 0; total += n) {
      n = await this.store.drain(this.batchSize, async (messages) => {
        const byTopic = new Map<string, typeof messages>();
        messages.forEach((m) => byTopic.set(m.topic, [...(byTopic.get(m.topic) ?? []), m]));
        for (const [topic, msgs] of byTopic) {
          await this.bus.publish(topic, msgs.map((m) => m.event));
          this.published.add(msgs.length, { topic });
        }
      });
    }
    return total;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.flush();
      if (n > 0) this.logger.log(`published ${n} event(s)`);
      this.pending = await this.store.pendingCount();
    } catch (err) {
      this.failures.add(1);
      this.logger.error(`outbox publish failed, will retry: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
