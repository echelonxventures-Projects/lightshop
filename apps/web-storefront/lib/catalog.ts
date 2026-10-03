import 'server-only';
import { LightshopApiError, createLightshopClient } from '@lightshop/api-sdk';
import type { ProductDetail, ProductSummary, VerticalPack } from '@lightshop/api-sdk';
import { getSession } from './session';
import { StoreContext } from './tenant';

export type { Offer as OfferView, ProductDetail, ProductSummary } from '@lightshop/api-sdk';

/** Gateway (production) or catalog subgraph (local dev); both speak the same API. */
const ENDPOINT = process.env.API_URL ?? process.env.CATALOG_GRAPHQL_URL ?? 'http://localhost:4001/graphql';

/** The storefront server is a trusted BFF: it selects the tenant explicitly and proves itself with the gateway secret. */
function client(store: StoreContext, withUser: boolean) {
  return createLightshopClient({
    endpoint: ENDPOINT,
    tenantId: store.tenant.id,
    gatewaySecret: process.env.GATEWAY_SHARED_SECRET,
    locale: store.locale,
    getToken: withUser ? async () => (await getSession(store))?.accessToken : undefined,
  });
}

/**
 * Public catalog reads: send the user's token (for future personalization) but never let a stale or
 * revoked token break browsing; fall back to an anonymous request instead.
 */
async function read<T>(store: StoreContext, fn: (c: ReturnType<typeof client>) => Promise<T>): Promise<T> {
  try {
    return await fn(client(store, true));
  } catch (err) {
    if (err instanceof LightshopApiError && err.code === 'UNAUTHENTICATED') return fn(client(store, false));
    throw err;
  }
}

export async function listProducts(store: StoreContext, vertical?: string): Promise<ProductSummary[]> {
  return (await read(store, (c) => c.products({ vertical, first: 48 }))).items;
}

export async function getProduct(store: StoreContext, id: string): Promise<ProductDetail | null> {
  return read(store, (c) => c.product(id));
}

export async function listPacks(store: StoreContext): Promise<VerticalPack[]> {
  return read(store, (c) => c.verticalPacks());
}
