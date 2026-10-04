# Local Development

## Zero-dependency mode (no Docker)

```bash
pnpm install
pnpm build
pnpm dev:catalog   # catalog subgraph on :4001 (in-memory storage + events, demo data seeded)
pnpm dev:web       # storefront on :5678
pnpm dev:registry  # optional: tenant-registry on :4002 (then set TENANTS_URL for catalog/web)
pnpm dev:gateway   # optional: public GraphQL edge on :4000 (set API_URL=http://localhost:4000/graphql for web)
```

`pnpm dev:catalog` turns on demo data (`SEED_DEMO=true`). It is off by default everywhere else.

Open http://acme.localhost:5678 (B2C marketplace) and http://verde.localhost:5678 (B2B wholesale). Both stores run from one storefront process.

## Writing data (auth)

Mutations need a bearer token. Locally, mint a dev token. No identity provider is needed:

```bash
TOKEN=$(pnpm -s dev:token --tenant acme-mart --roles catalog:admin)
curl -s localhost:4001/graphql -H 'content-type: application/json' -H 'host: acme.localhost' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { createProduct(input:{vertical:\"general\", titles:{en:\"Mug\"}, categoryPath:[], attributes:{brand:\"Kiln\"}}) { id } }"}'
```

Sellers: `--roles seller --seller sel_kora` (they can only add offers for `sel_kora`). Production uses a real OIDC provider (`OIDC_ISSUER`). See [ADR-0009](../adr/0009-service-security-baseline.md).

## Sign-in (OIDC)

```bash
pnpm infra:up:identity     # Keycloak with infra/keycloak/lightshop-realm.json (needs Docker)
export OIDC_ISSUER=http://localhost:8180/realms/lightshop
OIDC_CLIENT_ID=lightshop-storefront OIDC_CLIENT_SECRET=dev-storefront-secret-change-me \
  SESSION_SECRET=$(openssl rand -hex 32) pnpm dev:web
OIDC_JWKS_URL=$OIDC_ISSUER/protocol/openid-connect/certs pnpm dev:catalog
```

Sign in at http://acme.localhost:5678 as `ana` / `ana`. Without Docker, `node libs/testing/dist/mock-oidc-cli.js` starts a protocol-level mock provider on :4400 (client secret `mock-secret`).

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

Integration tests run against real services only when you provide them (CI always does):

```bash
TEST_DATABASE_URL=postgres://lightshop:lightshop@localhost:55432/lightshop \
  pnpm --filter @lightshop/catalog-service exec vitest run test/postgres.integration.test.ts
TEST_KAFKA_BROKERS=localhost:9092 \
  pnpm --filter @lightshop/adapters exec vitest run src/events/kafka-event-bus.integration.test.ts
```

Observability (traces, metrics, Grafana): see [observability](observability.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Store not found` | The Host must match a domain in `config/tenants/*.json`. Use `acme.localhost` or `verde.localhost`, not a bare IP. |
| `TENANT_NOT_FOUND` from GraphQL | Send a known Host header. `x-tenant-id` is honoured only from callers presenting `GATEWAY_SHARED_SECRET` (or from anyone locally when it is unset). |
| `UNAUTHENTICATED` / `FORBIDDEN` | Mint a token for the **same** tenant with a write role: `pnpm dev:token --tenant <id> --roles catalog:admin` |
| No products after start | Demo data is off by default; use `pnpm dev:catalog` or set `SEED_DEMO=true`. |
| Service refuses to boot in production | It lists the missing secure settings. See ADR-0009. |
| Outbox pending keeps growing | `EVENT_BUS=kafka` but Kafka is down. Check `/health` and `docker compose ps`. |
