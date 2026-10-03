import { newId } from '@lightshop/domain-kernel';
import { OutboxEntry, OutboxMessage, OutboxStore } from './types';

/** For in-memory repositories (tests, zero-dependency dev). */
export class InMemoryOutbox implements OutboxStore {
  private readonly messages: Array<OutboxMessage & { publishedAt?: Date }> = [];

  append(entries: OutboxEntry[]): void {
    for (const e of entries) this.messages.push({ id: newId('obx'), ...e });
  }

  async drain(limit: number, publish: (m: OutboxMessage[]) => Promise<void>): Promise<number> {
    const batch = this.messages.filter((m) => !m.publishedAt).slice(0, limit);
    if (batch.length === 0) return 0;
    await publish(batch.map(({ id, topic, event }) => ({ id, topic, event })));
    const now = new Date();
    batch.forEach((m) => (m.publishedAt = now));
    return batch.length;
  }

  async pendingCount(): Promise<number> {
    return this.messages.filter((m) => !m.publishedAt).length;
  }
}
