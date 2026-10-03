# Context Map

Each bounded context is one service (or a small group) owned by one team. Each context owns its data, and other contexts learn about changes only through events or federated GraphQL. Topic names follow `<context>.<entity>.v<major>`.

| # | Context | Service(s) | Owns | Publishes | Consumes | Phase |
|---|---|---|---|---|---|---|
| 1 | Identity & Accounts | `identity` | users, orgs, roles, consents, KYC/KYB status | `identity.user.v1`, `identity.org.v1` | — | 0 |
| 2 | Tenant Registry | `tenant-registry` ✅ | TenantConfig, domains, adapter credentials refs | `tenancy.tenant.v1` | — | 0–1 |
| 3 | Catalog & PIM | `catalog` ✅ | products, variants, offers, vertical packs | `catalog.product.v1` | `seller.account.v1` | 0 |
| 4 | Search & Discovery | `search` | search indexes, synonyms, merch rules | `search.query.v1` (analytics) | `catalog.*`, `pricing.*`, `inventory.*` | 1 |
| 5 | Pricing | `pricing` | price lists, tiers, contract prices, FX snapshots | `pricing.price.v1` | `catalog.*` | 1 |
| 6 | Promotions & Loyalty | `promotions` | coupons, cart rules, deals, points, memberships | `promotions.*` | `orders.*` | 1–3 |
| 7 | Cart & Checkout | `cart`, `checkout` | carts, checkout sessions | `checkout.session.v1` | `pricing.*`, `promotions.*`, `inventory.*` | 1 |
| 8 | Payments | `payments` | payment intents, PSP routing, wallets | `payments.payment.v1` | `orders.*` | 1 |
| 9 | Ledger & Finance | `ledger` | double-entry journal, payouts, invoices | `ledger.entry.v1`, `ledger.payout.v1` | `payments.*`, `orders.*`, `returns.*` | 1 |
| 10 | Orders (OMS) | `orders` | orders, shipments split, order lifecycle (Temporal) | `orders.order.v1` | `checkout.*`, `payments.*`, `logistics.*` | 1 |
| 11 | Inventory | `inventory` | stock per node, reservations, ATP | `inventory.stock.v1` | `orders.*`, `wms.*` | 1 |
| 12 | Warehouse (WMS) | `wms` | ASN, putaway, pick/pack waves, cycle counts | `wms.*` | `orders.*` | 2 |
| 13 | Logistics & Delivery | `logistics` | shipments, carrier labels, routes, POD | `logistics.shipment.v1` | `orders.*` | 1–2 |
| 14 | Returns | `returns` | RMAs, pickups, QC grades, refunds requests | `returns.rma.v1` | `orders.*`, `logistics.*` | 1 |
| 15 | Seller Platform | `seller` | seller accounts, storefronts, health metrics | `seller.account.v1` | `orders.*`, `returns.*`, `reviews.*` | 1 |
| 16 | B2B Wholesale | `b2b-rfq` | RFQs, quotes, negotiations, buyer approval flows | `b2b.rfq.v1`, `b2b.quote.v1` | `catalog.*`, `identity.org.*` | 2 |
| 17 | Omnichannel / Stores | `stores`, `pos` | stores, registers, store orders, BOPIS | `stores.*` | `inventory.*`, `orders.*` | 2 |
| 18 | Advertising | `ads` | campaigns, bids, budgets, attribution | `ads.impression.v1` | `search.*`, `orders.*` | 3 |
| 19 | Reviews & Q&A | `reviews` | ratings, reviews, Q&A, moderation state | `reviews.review.v1` | `orders.*` | 1 |
| 20 | Notifications | `notifications` | templates per tenant, preferences, deliveries | — | everything | 1 |
| 21 | Customer Service | `support` | tickets, claims, disputes | `support.*` | `orders.*`, `returns.*` | 1–2 |
| 22 | Trust, Safety & Risk | `risk` | risk scores, brand registry, takedowns | `risk.decision.v1` | `checkout.*`, `catalog.*`, `reviews.*` | 1–3 |
| 23 | Content (CMS) | `cms` | pages, banners, layout blocks per tenant | `cms.page.v1` | — | 1 |
| 24 | Analytics & Experimentation | `analytics-ingest` + data platform | event lake, metrics, experiments | — | everything (CDC) | 1–3 |

## Integration rules

- **Writes stay inside a context.** No service writes another service's database.
- **Reads across contexts** go through GraphQL federation (entity references such as `Product @key(fields: "id")`) or local read models built from events.
- **Events** are at-least-once. Consumers dedupe on `event.id` and keep per-aggregate order using the key `tenantId:aggregateId`.
- **Long-running flows** (order → payment → fulfillment → payout, RFQ → quote → order, return → refund) are Temporal workflows owned by the context that starts them.
- **Contracts** (`libs/contracts`) are versioned. Breaking changes need a new topic or field version and a deprecation window.
