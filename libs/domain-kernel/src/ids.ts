import { randomUUID } from 'node:crypto';

/** Prefixed, globally unique IDs ("prd_…", "ord_…") so an ID reveals its entity type in logs. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}
