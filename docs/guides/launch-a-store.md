# Launch a White-Label Store (zero code)

A store is entirely defined by a `TenantConfig`, with no code change, deploy or restart.

There are two ways to manage configs, with the same schema:
- **Tenant registry (recommended):** `PUT /v1/tenants/<id>` then `POST /v1/tenants/<id>/launch`. See [tenant-registry](../../services/tenant-registry/README.md). The admin console will call the same API.
- **Files:** `config/tenants/<id>.json`, for local development and as the registry's one-time import.

## 1. Write the config

```json
{
  "id": "bloom-beauty",
  "brand": { "name": "Bloom", "tagline": "Clean beauty, delivered.", "supportEmail": "care@bloom.example" },
  "theme": { "colorPrimary": "#B0306A", "colorAccent": "#F2B5D4", "radius": "lg" },
  "domains": ["bloom.localhost", "shop.bloom.example"],
  "regions": ["eu"],
  "locales": ["en-GB", "fr-FR"],
  "currencies": ["EUR", "GBP"],
  "businessModels": ["d2c"],
  "verticals": ["general"],
  "adapters": { "payments": ["manual"] },
  "features": {}
}
```

Fields and defaults: `libs/tenancy/src/tenant-config.ts`. Invalid configs fail at load with field-level errors.

## 2. Validate

```bash
pnpm --filter @lightshop/tenancy test   # loads and validates every config in config/tenants
```

## 3. Launch

With the registry: `POST /v1/tenants/<id>/launch` validates the config, verifies domain ownership through a DNS TXT record, and publishes. Services pick it up within `TENANTS_REFRESH_MS` (default 15 s).

With files: services re-read `config/tenants` on the same interval. No restart is needed either way.

## 4. Point DNS

Add a CNAME from the tenant's domain to the regional edge. TLS is issued automatically (cert-manager/ACME). For local testing, `*.localhost` already resolves to your machine: open http://bloom.localhost:5678.

## What you can change with config alone

| Change | Field |
|---|---|
| Brand name, logo, favicon, legal entity, support email | `brand` |
| Colors, corner radius, font | `theme` |
| Domains | `domains` |
| Data residency | `regions` (first = home) |
| Languages and currencies | `locales`, `currencies` |
| Marketplace / B2B / 1P / D2C, in any combination | `businessModels` |
| Industries | `verticals` (vertical pack IDs) |
| Payment, tax, search, shipping, notification providers | `adapters` |
| Features (RFQ, store pickup, delivery slots…) | `features` |
