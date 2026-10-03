import { DomainEvent } from '@lightshop/adapters';

export interface OutboxEntry {
  topic: string;
  event: DomainEvent;
}

export interface OutboxMessage extends OutboxEntry {
  id: string;
}

export interface OutboxStore {
  /** Claims up to `limit` unpublished messages, runs `publish`, and marks them published only if it resolves. */
  drain(limit: number, publish: (messages: OutboxMessage[]) => Promise<void>): Promise<number>;
  pendingCount(): Promise<number>;
}
