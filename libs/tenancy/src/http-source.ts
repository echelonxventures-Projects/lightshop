import { NOT_MODIFIED } from './live-registry';
import { TenantSource } from './registry';

export interface HttpTenantSourceOptions {
  /** e.g. http://tenant-registry/v1/tenants?status=live */
  url: string;
  /** Extra headers, e.g. the gateway trust header for internal calls. */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Reads tenant configs from the tenant-registry service; uses ETags so idle polls cost ~nothing. */
export class HttpTenantSource implements TenantSource {
  private etag?: string;

  constructor(private readonly options: HttpTenantSourceOptions) {}

  async list(): Promise<unknown[]> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const res = await fetchImpl(this.options.url, {
      headers: { accept: 'application/json', ...this.options.headers, ...(this.etag ? { 'if-none-match': this.etag } : {}) },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 5000),
    });
    if (res.status === 304) return NOT_MODIFIED;
    if (!res.ok) throw new Error(`Tenant registry responded ${res.status}`);
    const body = (await res.json()) as { tenants: unknown[] };
    this.etag = res.headers.get('etag') ?? undefined;
    return body.tenants;
  }
}
