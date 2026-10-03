/** Mirrors libs/contracts/schema/*.graphql (validated by operations.test.ts). */
export interface Money { amount: string; currency: string; formatted: string }
export type OfferCondition = 'NEW' | 'REFURBISHED' | 'USED';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Offer {
  id: string;
  sellerId: string;
  sku: string;
  price: Money;
  stock: number;
  condition: OfferCondition;
  moq: number;
}

export interface ProductSummary {
  id: string;
  title: string;
  vertical: string;
  offers: Array<Pick<Offer, 'id'>>;
  buyBox: Offer | null;
}

export interface ProductDetail extends Omit<ProductSummary, 'offers'> {
  description: string | null;
  categoryPath: string[];
  attributes: Record<string, unknown>;
  status: ProductStatus;
  offers: Offer[];
}

export interface VerticalPack {
  id: string;
  name: string;
  facets: string[];
  variantAxes: string[];
  attributeSchema: Record<string, unknown>;
}

export interface Page<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface CreateProductInput {
  vertical: string;
  titles: Record<string, string>;
  description?: string;
  categoryPath: string[];
  attributes: Record<string, unknown>;
  status?: ProductStatus;
}

export interface OfferInput {
  sellerId: string;
  sku: string;
  price: string;
  currency: string;
  stock: number;
  condition?: OfferCondition;
  moq?: number;
}
