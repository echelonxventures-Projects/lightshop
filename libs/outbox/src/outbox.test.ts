import { InMemoryEventBus } from '@lightshop/adapters';
import { describe, expect, it } from 'vitest';
import { InMemoryOutbox, OutboxRelay } from './index';

const entry = (topic: string, id: string) => ({
  topic,
  event: { id, type: 't', tenantId: 'x', region: 'us', aggregateId: id, occurredAt: '', version: 1, payload: {} },
});

describe('OutboxRelay + InMemoryOutbox', () => {
  it('publishes everything grouped by topic, once', async () => {
    const outbox = new InMemoryOutbox();
    const bus = new InMemoryEventBus();
    outbox.append([entry('a', '1'), entry('b', '2'), entry('a', '3')]);
    const relay = new OutboxRelay(outbox, bus, { batchSize: 2 });
    expect(await relay.flush()).toBe(3);
    expect(await relay.flush()).toBe(0);
    expect(bus.published.map((p) => `${p.topic}:${p.event.id}`)).toEqual(['a:1', 'b:2', 'a:3']);
  });

  it('keeps messages pending when the bus fails', async () => {
    const outbox = new InMemoryOutbox();
    outbox.append([entry('a', '1')]);
    const failing = { publish: async () => { throw new Error('down'); }, subscribe: async () => undefined, close: async () => undefined };
    await expect(new OutboxRelay(outbox, failing).flush()).rejects.toThrow('down');
    expect(await outbox.pendingCount()).toBe(1);
  });
});
