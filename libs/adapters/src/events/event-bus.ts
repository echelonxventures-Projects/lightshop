/** Envelope for every domain event on the bus. `key` keeps per-aggregate ordering. */
export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  tenantId: string;
  region: string;
  aggregateId: string;
  occurredAt: string;
  version: number;
  payload: T;
}

export interface EventBus {
  publish(topic: string, events: DomainEvent[]): Promise<void>;
  subscribe(topic: string, groupId: string, handler: (event: DomainEvent) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}
