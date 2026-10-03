import { DomainEvent, EventBus } from './event-bus';

/** For tests and single-process dev. Same contract as the Kafka adapter. */
export class InMemoryEventBus implements EventBus {
  readonly published: Array<{ topic: string; event: DomainEvent }> = [];
  private readonly handlers = new Map<string, Array<(e: DomainEvent) => Promise<void>>>();

  async publish(topic: string, events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.published.push({ topic, event });
      for (const handler of this.handlers.get(topic) ?? []) await handler(event);
    }
  }

  async subscribe(topic: string, _groupId: string, handler: (e: DomainEvent) => Promise<void>): Promise<void> {
    this.handlers.set(topic, [...(this.handlers.get(topic) ?? []), handler]);
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}
