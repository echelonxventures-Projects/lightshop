import { Attributes, trace } from '@opentelemetry/api';

/** Tag the active span with tenant/region so traces can be filtered per white-label store. */
export function annotateActiveSpan(attrs: { tenantId?: string; region?: string; userId?: string } & Attributes): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  const { tenantId, region, userId, ...rest } = attrs;
  span.setAttributes({
    ...(tenantId ? { 'lightshop.tenant_id': tenantId } : {}),
    ...(region ? { 'lightshop.region': region } : {}),
    ...(userId ? { 'enduser.id': userId } : {}),
    ...rest,
  });
}
