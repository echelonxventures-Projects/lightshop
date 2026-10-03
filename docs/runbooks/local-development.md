# Local Development

## Zero-dependency mode (no Docker)

```bash
pnpm install
pnpm build
pnpm dev:catalog   # catalog subgraph on :4001 (in-memory storage + events, demo data seeded)
pnpm dev:web       # storefront on :5678
```

Open http://acme.localhost:5678 (B2C marketplace) and http://verde.localhost:5678 (B2B wholesale). Both stores run from one storefront process.

## With real infrastructure

```bash
cp .env.example .env
pnpm infra:up          # Postgres + Kafka
# or: pnpm infra:up:full  (+ Valkey, OpenSearch, Temporal, Keycloak, S3-compatible storage)
set -a; source .env; set +a
pnpm dev:catalog
```

Check events reach Kafka:

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic catalog.product.v1 --from-beginning
```

## Tests

```bash
pnpm test                                        # all unit + service e2e tests
pnpm --filter @lightshop/web-storefront e2e      # Playwright: two tenants on one deployment
pnpm --filter @lightshop/ui storybook            # design system on :6006
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Store not found` | The Host must match a domain in `config/tenants/*.json`. Use `acme.localhost` or `verde.localhost`, not a bare IP. |
| `TENANT_NOT_FOUND` from GraphQL | Send `x-tenant-id` or a known Host header. |
| Outbox pending keeps growing | `EVENT_BUS=kafka` but Kafka is down. Check `/health` and `docker compose ps`. |
