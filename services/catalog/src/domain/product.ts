import { LocalizedText, Money, newId } from '@lightshop/domain-kernel';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type OfferCondition = 'NEW' | 'REFURBISHED' | 'USED';

/** One seller's terms for a product. Many offers per product = marketplace; one = D2C/1P. */
export interface Offer {
  id: string;
  sellerId: string;
  sku: string;
  price: Money;
  stock: number;
  condition: OfferCondition;
  moq: number;
}

export interface ProductProps {
  id: string;
  tenantId: string;
  region: string;
  vertical: string;
  titles: LocalizedText;
  description?: string;
  categoryPath: string[];
  attributes: Record<string, unknown>;
  status: ProductStatus;
  offers: Offer[];
  createdAt: Date;
  version: number;
}

export class Product {
  private constructor(private readonly props: ProductProps) {}

  static create(input: Omit<ProductProps, 'id' | 'offers' | 'createdAt' | 'version'> & { id?: string }): Product {
    if (Object.keys(input.titles).length === 0) throw new Error('Product needs at least one title');
    return new Product({ ...input, id: input.id ?? newId('prd'), offers: [], createdAt: new Date(), version: 1 });
  }

  static rehydrate(props: ProductProps): Product {
    return new Product(props);
  }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get region() { return this.props.region; }
  get vertical() { return this.props.vertical; }
  get titles() { return this.props.titles; }
  get description() { return this.props.description; }
  get categoryPath() { return this.props.categoryPath; }
  get attributes() { return this.props.attributes; }
  get status() { return this.props.status; }
  get offers(): readonly Offer[] { return this.props.offers; }
  get createdAt() { return this.props.createdAt; }
  get version() { return this.props.version; }

  addOffer(input: Omit<Offer, 'id'>): Offer {
    if (input.stock < 0) throw new Error('Stock cannot be negative');
    if (input.moq < 1) throw new Error('MOQ must be at least 1');
    if (input.price.isNegative() || input.price.isZero()) throw new Error('Price must be positive');
    if (this.props.offers.some((o) => o.sellerId === input.sellerId && o.sku === input.sku)) {
      throw new Error(`Seller ${input.sellerId} already has an offer for SKU ${input.sku}`);
    }
    const existing = this.props.offers[0];
    if (existing && existing.price.currency !== input.price.currency) {
      throw new Error(`Offers on one product must share a currency within a region (${existing.price.currency})`);
    }
    const offer: Offer = { ...input, id: newId('ofr') };
    this.props.offers.push(offer);
    this.props.version++;
    return offer;
  }

  /**
   * Buy box: the offer shown on the product page's primary "Add to cart".
   * MVP rule = lowest price among in-stock NEW offers; used/refurbished offers compete only when no
   * NEW offer is in stock (they are listed separately under "other sellers").
   * Phase 3 replaces this with a scored model (landed price, delivery promise, seller health).
   */
  buyBox(): Offer | undefined {
    const inStock = this.props.offers.filter((o) => o.stock > 0);
    const fresh = inStock.filter((o) => o.condition === 'NEW');
    return [...(fresh.length ? fresh : inStock)].sort((a, b) => a.price.compare(b.price))[0];
  }

  toProps(): ProductProps {
    return { ...this.props, offers: [...this.props.offers] };
  }
}
