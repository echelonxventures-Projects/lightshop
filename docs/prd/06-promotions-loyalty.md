# PRD: Promotions, Deals & Loyalty

**Phase:** 1–3 · **Owning team:** Growth squad

## Purpose

Configurable incentives without code: coupons, cart rules, flash deals, bank offers, loyalty points, paid memberships.

## MVP scope

- Coupons and cart rules (percent, fixed, BOGO, free shipping, thresholds)
- Stacking and exclusivity rules
- Budget caps and per-customer limits
- Flash/lightning deals with countdown and reserved stock
- Gift cards and store credit

## Later scope

- Loyalty points and tiers
- Paid membership (free fast shipping, exclusive deals)
- Referral programs
- Bank/card-issuer offers
- Event mode (mega sale days) with pre-warm and waiting room

## Key entities

`Promotion`, `Coupon`, `Budget`, `Deal`, `LoyaltyAccount`, `Membership`, `GiftCard`

## API surface

`applicablePromotions(cart)`, `redeemCoupon`, admin promotion builder

## Events published

- `promotions.redemption.v1`
- `promotions.membership.v1`

## Business-model notes

B2B: usually disabled or negotiated via quotes; D2C/B2C: full toolset.

## Non-functional requirements and acceptance

- Promotion evaluation p95 < 30 ms
- Abuse controls integrated with risk (multi-account, coupon farming)

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
