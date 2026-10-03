# Add a Vendor Adapter

Example: a Stripe payments adapter.

1. Create `libs/adapters/src/payments/stripe-provider.ts` implementing `PaymentProvider`. Vendor SDK imports are allowed only under `libs/adapters` (lint-enforced).
2. Normalize vendor semantics to the port: map statuses to `PaymentStatus`, pass the `idempotencyKey` through, and turn webhooks into `payments.payment.v1` events.
3. Credentials come from the tenant's secret references (Vault/KMS) and are never stored in `TenantConfig`.
4. Register it in the payments service: `registry.register('stripe', () => new StripePaymentProvider(secrets))`.
5. Add a contract test: the shared port test suite must pass against the vendor's sandbox.
6. Tenants opt in with `"adapters": { "payments": ["stripe", "manual"] }`.

Removing a vendor is the same steps in reverse. Domain code never changes.
