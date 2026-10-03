# ADR-0004: Temporal for long-running business workflows

**Status:** Accepted · 2026-10-03

## Context
Order fulfillment, returns, seller payouts, RFQ negotiation and subscription renewals span minutes to weeks. They involve retries, timeouts, human steps and compensation.

## Decision
Use **Temporal** (MIT-licensed, self-hostable) with the TypeScript SDK. Each workflow belongs to the bounded context that starts it, and activities call that context's own application services or publish events.

## Consequences
- Saga state is durable and visible in Temporal UI. Retries and timers live in code, not cron jobs.
- Temporal is another stateful system to operate. It runs per cell on the cell's Postgres.
- Workflow code must be deterministic, which is enforced by the SDK and code review.

## Alternatives considered
Choreography-only sagas (hard to reason about at this scale), AWS Step Functions (cloud lock-in), BPMN engines (heavier, weaker TypeScript support).
