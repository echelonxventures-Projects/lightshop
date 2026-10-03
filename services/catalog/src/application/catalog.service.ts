import { DomainEvent } from '@lightshop/adapters';
import { Principal, Roles, hasRole } from '@lightshop/auth';
import { CatalogEventTypes, OfferAddedPayload, ProductCreatedPayload, Topics } from '@lightshop/contracts';
import { Money, newId } from '@lightshop/domain-kernel';
import { VerticalPack, VerticalPackRegistry } from '@lightshop/vertical-packs';
import { Inject, Injectable } from '@nestjs/common';
import { Offer, OfferCondition, Product, ProductStatus } from '../domain/product';
import { Page, ProductRepository } from '../infrastructure/product-repository';
import { PRODUCT_REPOSITORY, VERTICAL_PACKS } from '../tokens';
import { CatalogError } from './errors';
import { RequestContext } from './request-context';

export interface CreateProductCommand {
  vertical: string;
  titles: Record<string, string>;
  description?: string;
  categoryPath: string[];
  attributes: Record<string, unknown>;
  status?: ProductStatus;
}

export interface AddOfferCommand {
  sellerId: string;
  sku: string;
  price: string;
  currency: string;
  stock: number;
  condition?: OfferCondition;
  moq?: number;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(VERTICAL_PACKS) private readonly packs: VerticalPackRegistry,
  ) {}

  /** Only packs the tenant enabled in its TenantConfig — white-label stores pick their industries. */
  verticalPacks(ctx: RequestContext): VerticalPack[] {
    return this.packs.list(ctx.tenant.verticals);
  }

  async createProduct(ctx: RequestContext, cmd: CreateProductCommand, opts: { id?: string } = {}): Promise<Product> {
    this.authorize(ctx, Roles.CatalogAdmin, Roles.Seller);
    if (!ctx.tenant.verticals.includes(cmd.vertical)) {
      throw new CatalogError('FORBIDDEN_VERTICAL', `Vertical "${cmd.vertical}" is not enabled for ${ctx.tenant.brand.name}`);
    }
    if (!this.packs.isAllowedIn(cmd.vertical, ctx.region)) {
      throw new CatalogError('FORBIDDEN_VERTICAL', `Vertical "${cmd.vertical}" is restricted in region ${ctx.region}`);
    }
    const attributes = structuredClone(cmd.attributes);
    const validation = this.packs.validate(cmd.vertical, attributes);
    if (!validation.valid) {
      throw new CatalogError('VALIDATION_FAILED', 'Product attributes do not match the vertical pack', validation.errors);
    }

    const product = Product.create({
      id: opts.id,
      tenantId: ctx.tenantId,
      region: ctx.region,
      vertical: cmd.vertical,
      titles: cmd.titles,
      description: cmd.description,
      categoryPath: cmd.categoryPath,
      attributes,
      status: cmd.status ?? 'ACTIVE',
    });
    const payload: ProductCreatedPayload = {
      productId: product.id, vertical: product.vertical, titles: product.titles,
      categoryPath: product.categoryPath, attributes: product.attributes, status: product.status,
    };
    await this.products.save(product, [{ topic: Topics.CatalogProduct, event: this.event(ctx, product, CatalogEventTypes.ProductCreated, payload) }]);
    return product;
  }

  async addOffer(ctx: RequestContext, productId: string, cmd: AddOfferCommand): Promise<Product> {
    const principal = this.authorize(ctx, Roles.CatalogAdmin, Roles.Seller);
    if (!hasRole(principal, Roles.CatalogAdmin) && principal.sellerId !== cmd.sellerId) {
      throw new CatalogError('FORBIDDEN', 'Sellers can only create offers for their own seller account');
    }
    if (!ctx.tenant.currencies.includes(cmd.currency)) {
      throw new CatalogError('UNSUPPORTED_CURRENCY', `${ctx.tenant.brand.name} does not sell in ${cmd.currency}`);
    }
    const product = await this.getProduct(ctx, productId);
    let offer: Offer;
    try {
      offer = product.addOffer({
        sellerId: cmd.sellerId,
        sku: cmd.sku,
        price: Money.of(cmd.price, cmd.currency),
        stock: cmd.stock,
        condition: cmd.condition ?? 'NEW',
        // B2B packs carry an MOQ attribute; it is the floor for every offer.
        moq: Math.max(cmd.moq ?? 1, Number(product.attributes.moq ?? 1)),
      });
    } catch (err) {
      throw new CatalogError('VALIDATION_FAILED', (err as Error).message);
    }
    const payload: OfferAddedPayload = {
      productId: product.id, offerId: offer.id, sellerId: offer.sellerId, sku: offer.sku,
      price: offer.price.toJSON(), stock: offer.stock,
    };
    await this.products.save(product, [{ topic: Topics.CatalogProduct, event: this.event(ctx, product, CatalogEventTypes.OfferAdded, payload) }]);
    return product;
  }

  async getProduct(ctx: RequestContext, id: string): Promise<Product> {
    const product = await this.products.findById(ctx.tenantId, id);
    if (!product) throw new CatalogError('NOT_FOUND', `Product ${id} not found`);
    return product;
  }

  async findProduct(ctx: RequestContext, id: string): Promise<Product | undefined> {
    return this.products.findById(ctx.tenantId, id);
  }

  async listProducts(ctx: RequestContext, args: { vertical?: string; first?: number; after?: string }): Promise<Page<Product>> {
    const first = Math.min(Math.max(args.first ?? 20, 1), 100);
    try {
      return await this.products.list(ctx.tenantId, { vertical: args.vertical, first, after: args.after });
    } catch (err) {
      throw new CatalogError('VALIDATION_FAILED', (err as Error).message);
    }
  }

  async countProducts(ctx: RequestContext): Promise<number> {
    return this.products.count(ctx.tenantId);
  }

  /**
   * Writes require an authenticated principal issued for *this* tenant with one of `roles`.
   * A token from tenant A is useless against tenant B even if the caller controls the Host header.
   */
  private authorize(ctx: RequestContext, ...roles: string[]): Principal {
    const principal = ctx.principal;
    if (!principal) throw new CatalogError('UNAUTHENTICATED', 'Sign in required');
    if (principal.tenantId !== ctx.tenantId) throw new CatalogError('FORBIDDEN', 'Token was issued for a different store');
    if (!hasRole(principal, ...roles)) throw new CatalogError('FORBIDDEN', `Requires one of: ${roles.join(', ')}`);
    return principal;
  }

  private event<T>(ctx: RequestContext, product: Product, type: string, payload: T): DomainEvent<T> {
    return {
      id: newId('evt'), type, tenantId: ctx.tenantId, region: ctx.region, aggregateId: product.id,
      occurredAt: new Date().toISOString(), version: product.version, payload,
    };
  }
}
