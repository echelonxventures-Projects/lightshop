import { eventually, integration } from '@lightshop/testing';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DomainEvent } from './event-bus';
import { KafkaEventBus } from './kafka-event-bus';

const BROKERS = integration('TEST_KAFKA_BROKERS');

describe.skipIf(!BROKERS)('KafkaEventBus (integration)', () => {
  let bus: KafkaEventBus;
  beforeAll(() => {
    bus = new KafkaEventBus(BROKERS!.split(','), 'lightshop-it');
  });
  afterAll(() => bus?.close());

  it('publishes and consumes events with tenant-keyed ordering preserved', async () => {
    const topic = `it.events.${randomUUID()}`;
    const received: DomainEvent[] = [];
    const events: DomainEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `evt_${i}`, type: 'it.created', tenantId: 'acme-mart', region: 'us', aggregateId: 'agg_1',
      occurredAt: new Date().toISOString(), version: i + 1, payload: { i },
    }));

    // Topic must exist before the consumer group joins; first publish auto-creates it.
    await bus.publish(topic, events.slice(0, 1));
    await bus.subscribe(topic, `it-${randomUUID()}`, async (e) => void received.push(e));
    await bus.publish(topic, events.slice(1));

    await eventually(() => (received.length >= 5 ? true : undefined), 30_000);
    expect(received.map((e) => e.version)).toEqual([1, 2, 3, 4, 5]);
    expect(received[0]).toMatchObject({ tenantId: 'acme-mart', type: 'it.created', payload: { i: 0 } });
  }, 60_000);
});
