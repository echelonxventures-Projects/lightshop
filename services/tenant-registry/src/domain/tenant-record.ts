import { TenantConfig } from '@lightshop/tenancy';

export type TenantStatus = TenantConfig['status'];

/** A versioned TenantConfig plus audit metadata. `config.status` is the lifecycle state. */
export interface TenantRecord {
  config: TenantConfig;
  version: number;
  updatedAt: Date;
  updatedBy: string;
}
