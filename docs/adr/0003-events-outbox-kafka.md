# ADR-0003: Transactional outbox + Kafka protocol for integration events

**Status:** Accepted · 2026-10-03

## Context
Services must react to each other's changes (catalog → search index, order → inventory → logistics) without distributed transactions and without losing or inventing events.

## Decision
- Services write the aggregate **and** its domain events in the same database transaction (`outbox` table).
- A relay drains the outbox with `FOR UPDATE SKIP LOCKED` (safe with many replicas) and publishes through the `EventBus` port. Debezium CDC can replace polling at higher volume.
- The bus speaks the **Kafka protocol**. Local dev uses Apache Kafka. Production may use self-managed Kafka, Redpanda, MSK, Confluent or Aiven without code changes.
- The event envelope is `{ id, type, tenantId, region, aggregateId, occurredAt, version, payload }`, with key `tenantId:aggregateId` for per-aggregate ordering.
- Delivery is at-least-once, and consumers dedupe on `event.id`.

## Consequences
- An event exists if and only if its state change committed. This is implemented in `services/catalog/src/infrastructure/postgres-product-repository.ts` and verified by the catalog e2e test.
- Events reach consumers with small latency (poll interval, 500 ms by default).
- An in-memory bus adapter keeps tests and local dev dependency-free.
