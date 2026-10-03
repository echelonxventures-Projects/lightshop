import { Money, localize } from '@lightshop/domain-kernel';
import { VerticalPack } from '@lightshop/vertical-packs';
import { Inject } from '@nestjs/common';
import { Args, Context, Mutation, Parent, Query, ResolveField, ResolveReference, Resolver } from '@nestjs/graphql';
import { AddOfferCommand, CatalogService, CreateProductCommand } from '../application/catalog.service';
import { Offer, Product } from '../domain/product';
import { encodeCursor } from '../infrastructure/product-repository';
import { GqlContext, requireContext } from './context';

const toMoney = (m: Money, locale: string) => ({ amount: m.toDecimal(), currency: m.currency, formatted: m.format(locale) });

@Resolver('Product')
export class ProductResolver {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Query('product')
  product(@Args('id') id: string, @Context() gql: GqlContext) {
    return this.catalog.findProduct(requireContext(gql), id);
  }

  @Query('products')
  async products(
    @Args('vertical') vertical: string | undefined,
    @Args('first') first: number | undefined,
    @Args('after') after: string | undefined,
    @Context() gql: GqlContext,
  ) {
    const page = await this.catalog.listProducts(requireContext(gql), { vertical, first, after });
    const edges = page.items.map((node) => ({ cursor: encodeCursor(node), node }));
    return { edges, pageInfo: { hasNextPage: page.hasNextPage, endCursor: edges.at(-1)?.cursor ?? null } };
  }

  @Mutation('createProduct')
  createProduct(@Args('input') input: CreateProductCommand, @Context() gql: GqlContext) {
    return this.catalog.createProduct(requireContext(gql), input);
  }

  @Mutation('addOffer')
  addOffer(@Args('productId') productId: string, @Args('input') input: AddOfferCommand, @Context() gql: GqlContext) {
    return this.catalog.addOffer(requireContext(gql), productId, input);
  }

  /** Federation: other subgraphs (orders, reviews, search) reference Product by id. */
  @ResolveReference()
  resolveReference(ref: { id: string }, gql: GqlContext) {
    return this.catalog.findProduct(requireContext(gql), ref.id);
  }

  @ResolveField('title')
  title(@Parent() p: Product, @Context() gql: GqlContext) {
    return localize(p.titles, requireContext(gql).locale, ['en']);
  }

  @ResolveField('titles')
  titles(@Parent() p: Product) {
    return p.titles;
  }

  @ResolveField('buyBox')
  buyBox(@Parent() p: Product) {
    return p.buyBox() ?? null;
  }

  @ResolveField('createdAt')
  createdAt(@Parent() p: Product) {
    return p.createdAt.toISOString();
  }
}

@Resolver('Offer')
export class OfferResolver {
  @ResolveField('price')
  price(@Parent() o: Offer, @Context() gql: GqlContext) {
    return toMoney(o.price, requireContext(gql).locale);
  }
}

@Resolver('VerticalPack')
export class VerticalPackResolver {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Query('verticalPacks')
  verticalPacks(@Context() gql: GqlContext) {
    return this.catalog.verticalPacks(requireContext(gql));
  }

  @ResolveField('name')
  name(@Parent() pack: VerticalPack, @Context() gql: GqlContext) {
    return localize(pack.name, requireContext(gql).locale);
  }

  @ResolveField('attributeSchema')
  attributeSchema(@Parent() pack: VerticalPack) {
    return pack.attributes;
  }
}
