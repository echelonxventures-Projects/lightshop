# Add an Industry (Vertical Pack)

Industries are data. To add one, for example **Automotive Parts**:

1. Create `libs/vertical-packs/src/packs/automotive.json`, using `electronics.json` as a template:
   - `attributes`: JSON Schema for the product fields (`fitment` array of `{make, model, yearFrom, yearTo}`, `oemNumber`, …)
   - `facets`: attributes to filter on (each must exist in `attributes.properties`)
   - `variantAxes`, `compliance`, `fulfillment`, `returns`
2. Import it in `src/vertical-pack.ts` and add it to `BUILT_IN_PACKS`. A tenant-private pack can instead be registered at runtime with `VerticalPackRegistry.register()` (admin console in Phase 1).
3. Add a test case in `src/vertical-pack.test.ts` for one valid and one invalid product.
4. Enable it for a tenant by adding `"automotive"` to that tenant's `verticals`.

Seller listing forms, search facets and PDP specification tables pick it up automatically.

**When code *is* needed:** a capability that is behaviour rather than data (fitment lookup by VIN, prescription review queue, live gold-rate pricing) is built once as a capability module, and packs switch it on by flag. Never branch on a pack ID in core code.
