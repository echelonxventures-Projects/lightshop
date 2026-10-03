import { Consumer, Kafka, Producer } from 'kafkajs';
import { DomainEvent, EventBus } from './event-bus';

/**
 * Kafka-protocol adapter. Works against Apache Kafka, Redpanda, MSK, Confluent, Aiven, etc.,
 * so the protocol is the contract, not a vendor.
 */
export class KafkaEventBus implements EventBus {
  private readonly kafka: Kafka;
  private producer?: Producer;
  private readonly consumers: Consumer[] = [];

  constructor(brokers: string[], clientId = 'lightshop') {
    this.kafka = new Kafka({ clientId, brokers });
  }

  async publish(topic: string, events: DomainEvent[]): Promise<void> {
    if (!this.producer) {
      this.producer = this.kafka.producer({ idempotent: true, maxInFlightRequests: 1 });
      await this.producer.connect();
    }
    await this.producer.send({
      topic,
      messages: events.map((e) => ({
        key: `${e.tenantId}:${e.aggregateId}`,
        value: JSON.stringify(e),
        headers: { 'event-type': e.type, 'tenant-id': e.tenantId, region: e.region },
      })),
    });
  }

  async subscribe(topic: string, groupId: string, handler: (e: DomainEvent) => Promise<void>): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (message.value) await handler(JSON.parse(message.value.toString()) as DomainEvent);
      },
    });
    this.consumers.push(consumer);
  }

  async close(): Promise<void> {
    await Promise.all([this.producer?.disconnect(), ...this.consumers.map((c) => c.disconnect())]);
  }
}
