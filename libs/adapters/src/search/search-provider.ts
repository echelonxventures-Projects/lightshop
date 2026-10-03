export interface SearchDocument {
  id: string;
  tenantId: string;
  region: string;
  locale: string;
  title: string;
  text: string;
  categoryPath: string[];
  facets: Record<string, string | number | boolean | string[]>;
  priceMinor?: number;
  embedding?: number[];
}

export interface SearchQuery {
  tenantId: string;
  region: string;
  locale: string;
  text?: string;
  filters?: Record<string, string | string[]>;
  facets?: string[];
  page?: { size: number; from: number };
}

export interface SearchResult {
  total: number;
  hits: Array<{ id: string; score: number }>;
  facets: Record<string, Array<{ value: string; count: number }>>;
}

/** Port for search engines: Postgres FTS (default), OpenSearch, Meilisearch, Typesense, Vespa. */
export interface SearchProvider {
  readonly id: string;
  index(docs: SearchDocument[]): Promise<void>;
  remove(tenantId: string, ids: string[]): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult>;
}
