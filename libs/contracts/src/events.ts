/** Kafka topics are owned by exactly one service and named <context>.<entity>.v<major>. */
export const Topics = {
  CatalogProduct: 'catalog.product.v1',
  TenancyTenant: 'tenancy.tenant.v1',
} as const;

export const CatalogEventTypes = {
  ProductCreated: 'catalog.product.created',
  OfferAdded: 'catalog.product.offer-added',
} as const;

export interface ProductCreatedPayload {
  productId: string;
  vertical: string;
  titles: Record<string, string>;
  categoryPath: string[];
  attributes: Record<string, unknown>;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export interface OfferAddedPayload {
  productId: string;
  offerId: string;
  sellerId: string;
  sku: string;
  price: { amount: string; currency: string };
  stock: number;
}

export const TenancyEventTypes = {
  Created: 'tenancy.tenant.created',
  Updated: 'tenancy.tenant.updated',
  Published: 'tenancy.tenant.published',
  Suspended: 'tenancy.tenant.suspended',
} as const;

/** Full config travels with every event so consumers can update local caches without calling back. */
export interface TenantChangedPayload {
  tenantId: string;
  version: number;
  status: 'draft' | 'live' | 'suspended';
  config: Record<string, unknown>;
}
