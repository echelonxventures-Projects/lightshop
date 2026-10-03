import { Principal } from '@lightshop/auth';
import { TenantContext } from '@lightshop/domain-kernel';
import { TenantConfig } from '@lightshop/tenancy';

/** Resolved per request at the edge; every use case receives it explicitly. */
export interface RequestContext extends TenantContext {
  tenant: TenantConfig;
  /** Present only when the caller sent a valid access token for this tenant. */
  principal?: Principal;
}
