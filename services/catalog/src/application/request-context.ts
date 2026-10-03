import { TenantContext } from '@lightshop/domain-kernel';
import { TenantConfig } from '@lightshop/tenancy';

/** Resolved per request at the edge; every use case receives it explicitly. */
export interface RequestContext extends TenantContext {
  tenant: TenantConfig;
}
