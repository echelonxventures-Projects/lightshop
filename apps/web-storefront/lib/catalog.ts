import 'server-only';
import { StoreContext } from './tenant';

const ENDPOINT = process.env.CATALOG_GRAPHQL_URL ?? 'http://localhost:4001/graphql';
/** The storefront server acts as a trusted BFF: it proves itself so services honour x-tenant-id. */
const GATEWAY_SECRET = process.env.GATEWAY_SHARED_SECRET;

export interface MoneyView { amount: string; currency: string; formatted: string }
export interface OfferView { id: string; sellerId: string; sku: string; price: MoneyView; stock: number; condition: string; moq: number }
export interface ProductSummary { id: string; title: string; vertical: string; offers: Array<{ id: string }>; buyBox: OfferView | null }
export interface ProductDetail extends ProductSummary {
  description: string | null;
  categoryPath: string[];
  attributes: Record<string, unknown>;
  offers: OfferView[];
}
export interface PackView { id: string; name: string; facets: string[] }

const OFFER = `id sellerId sku stock condition moq price { amount currency formatted }`;

async function query<T>(store: StoreContext, gql: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': store.tenant.id,
      'accept-language': store.locale,
      ...(GATEWAY_SECRET ? { 'x-lightshop-gateway-token': GATEWAY_SECRET } : {}),
    },
    body: JSON.stringify({ query: gql, variables }),
    cache: 'no-store',
  });
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data as T;
}

export async function listProducts(store: StoreContext, vertical?: string): Promise<ProductSummary[]> {
  const data = await query<{ products: { edges: Array<{ node: ProductSummary }> } }>(
    store,
    `query($vertical: String) { products(vertical: $vertical, first: 48) { edges { node { id title vertical offers { id } buyBox { ${OFFER} } } } } }`,
    { vertical },
  );
  return data.products.edges.map((e) => e.node);
}

export async function getProduct(store: StoreContext, id: string): Promise<ProductDetail | null> {
  const data = await query<{ product: ProductDetail | null }>(
    store,
    `query($id: ID!) { product(id: $id) { id title vertical description categoryPath attributes offers { ${OFFER} } buyBox { ${OFFER} } } }`,
    { id },
  );
  return data.product;
}

export async function listPacks(store: StoreContext): Promise<PackView[]> {
  return (await query<{ verticalPacks: PackView[] }>(store, `{ verticalPacks { id name facets } }`)).verticalPacks;
}
