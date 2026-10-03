/** Kafka topics are owned by exactly one service and named <context>.<entity>.v<major>. */
export const Topics = {
  CatalogProduct: 'catalog.product.v1',
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
