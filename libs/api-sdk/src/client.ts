import { Operations } from './operations';
import { CreateProductInput, OfferInput, Page, ProductDetail, ProductSummary, VerticalPack } from './types';

export interface ClientOptions {
  /** Gateway GraphQL endpoint, e.g. https://api.acme.example/graphql (browser: same-origin /graphql). */
  endpoint: string;
  /** Returns the user's access token, if signed in. */
  getToken?: () => string | undefined | Promise<string | undefined>;
  locale?: string;
  /**
   * Server-side BFF only: select the tenant explicitly. Services honour it only together with
   * `gatewaySecret` (or in local dev with no secret configured). Never ship the secret to browsers.
   */
  tenantId?: string;
  gatewaySecret?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Stable error with the API's machine-readable code (e.g. UNAUTHENTICATED, VALIDATION_FAILED, RATE_LIMITED). */
export class LightshopApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'LightshopApiError';
  }
}

type GqlResponse<T> = { data?: T | null; errors?: Array<{ message: string; extensions?: { code?: string; details?: string[] } }> };

export class LightshopClient {
  constructor(private readonly options: ClientOptions) {}

  /** Escape hatch for operations not wrapped yet. */
  async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const { options } = this;
    const token = await options.getToken?.();
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (options.locale) headers['accept-language'] = options.locale;
    if (options.tenantId) headers['x-tenant-id'] = options.tenantId;
    if (options.gatewaySecret) headers['x-lightshop-gateway-token'] = options.gatewaySecret;
    const res = await (options.fetchImpl ?? fetch)(options.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
    let body: GqlResponse<T>;
    try {
      body = (await res.json()) as GqlResponse<T>;
    } catch {
      throw new LightshopApiError(`API responded ${res.status} with a non-JSON body`, 'BAD_RESPONSE', res.status);
    }
    const first = body.errors?.[0];
    if (first) throw new LightshopApiError(first.message, first.extensions?.code ?? 'UNKNOWN', res.status, first.extensions?.details ?? []);
    if (!body.data) throw new LightshopApiError('API returned no data', 'BAD_RESPONSE', res.status);
    return body.data;
  }

  async products(args: { vertical?: string; first?: number; after?: string } = {}): Promise<Page<ProductSummary>> {
    const data = await this.request<{ products: { edges: Array<{ node: ProductSummary }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }>(
      Operations.products,
      args,
    );
    return { items: data.products.edges.map((e) => e.node), ...data.products.pageInfo };
  }

  async product(id: string): Promise<ProductDetail | null> {
    return (await this.request<{ product: ProductDetail | null }>(Operations.product, { id })).product;
  }

  async verticalPacks(): Promise<VerticalPack[]> {
    return (await this.request<{ verticalPacks: VerticalPack[] }>(Operations.verticalPacks)).verticalPacks;
  }

  async createProduct(input: CreateProductInput): Promise<ProductDetail> {
    return (await this.request<{ createProduct: ProductDetail }>(Operations.createProduct, { input })).createProduct;
  }

  async addOffer(productId: string, input: OfferInput): Promise<ProductDetail> {
    return (await this.request<{ addOffer: ProductDetail }>(Operations.addOffer, { productId, input })).addOffer;
  }
}

export function createLightshopClient(options: ClientOptions): LightshopClient {
  return new LightshopClient(options);
}
