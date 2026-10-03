## Summary

## Checklist
- [ ] Tenant-scoped and white-label (no hard-coded brand, copy or tenant IDs)
- [ ] External services only through `libs/adapters` ports
- [ ] Security baseline respected (ADR-0009): authz in application layer, no identity from plain headers
- [ ] Contracts (`libs/contracts`) changed? Backwards compatible or versioned
- [ ] Tests added/updated; `pnpm affected` passes
- [ ] Docs/ADR updated if behaviour or architecture changed
