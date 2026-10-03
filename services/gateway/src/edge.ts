import { AuthError, GATEWAY_TOKEN_HEADER, Principal, TokenVerifier, isTrustedGateway } from '@lightshop/auth';
import { LOCALE_HEADER, REGION_HEADER, TENANT_HEADER } from '@lightshop/domain-kernel';
import { annotateActiveSpan } from '@lightshop/observability';
import { TenantConfig, TenantLookup, normalizeHost } from '@lightshop/tenancy';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { GatewayConfig } from './config';
import { RateLimiter } from './rate-limiter';

/** Headers a client may send that are forwarded to subgraphs. Everything identity-related is set by the gateway. */
const FORWARDED_CLIENT_HEADERS = [LOCALE_HEADER, REGION_HEADER, 'x-currency', 'authorization', 'traceparent', 'tracestate'];

export interface EdgeDeps {
  config: GatewayConfig;
  tenants: TenantLookup;
  verifier: TokenVerifier;
  limiter: RateLimiter;
  /** The federation runtime (fetch-compatible). */
  graphql: (request: Request) => Promise<Response>;
}

type EdgeRequest = IncomingMessage & { body?: Buffer };

/**
 * The public edge: everything untrusted is decided here before a request reaches the federated graph.
 *   tenant (Host, or x-tenant-id from a trusted BFF) → CORS → rate limit → token → sanitized headers → graph
 */
export function createEdgeHandler(deps: EdgeDeps) {
  const { config } = deps;

  return async (req: EdgeRequest, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://edge');
    if (url.pathname === '/health') return send(res, 200, { status: 'ok', service: 'gateway' });
    if (url.pathname !== '/graphql') return graphqlError(res, 404, 'NOT_FOUND', 'Not found');

    const trustedBff = isTrustedGateway(header(req, GATEWAY_TOKEN_HEADER), config.gatewaySecret);
    const tenant = resolveTenant(req, deps.tenants, trustedBff, config.trustProxy);
    if (!tenant) return graphqlError(res, 404, 'TENANT_NOT_FOUND', 'Unknown or inactive store');

    const origin = header(req, 'origin');
    if (origin) {
      if (!originAllowed(origin, tenant)) return graphqlError(res, 403, 'FORBIDDEN', 'Origin not allowed for this store');
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('access-control-allow-credentials', 'true');
      res.setHeader('vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      res.setHeader('access-control-allow-headers', 'authorization, content-type, accept-language, x-region, x-currency, traceparent');
      res.setHeader('access-control-max-age', '600');
      res.statusCode = 204;
      return void res.end();
    }

    const ip = clientIp(req, config.trustProxy);
    const retryAfter = trustedBff ? 0 : deps.limiter.take(`${tenant.id}:${ip}`);
    if (retryAfter > 0) {
      res.setHeader('retry-after', String(retryAfter));
      return graphqlError(res, 429, 'RATE_LIMITED', 'Too many requests');
    }

    let principal: Principal | undefined;
    const bearer = header(req, 'authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer) {
      try {
        principal = await deps.verifier.verify(bearer);
      } catch (err) {
        return graphqlError(res, 401, 'UNAUTHENTICATED', err instanceof AuthError ? err.message : 'Invalid access token');
      }
      const platformAdmin = principal.roles.includes('platform:admin');
      if (principal.tenantId !== tenant.id && !platformAdmin) {
        return graphqlError(res, 403, 'FORBIDDEN', 'Token was issued for a different store');
      }
    }
    annotateActiveSpan({ tenantId: tenant.id, userId: principal?.userId });

    // Rebuild headers from scratch: client-sent identity headers never pass through.
    const headers = new Headers({ 'content-type': header(req, 'content-type') ?? 'application/json', accept: 'application/json' });
    for (const name of FORWARDED_CLIENT_HEADERS) {
      const v = header(req, name);
      if (v) headers.set(name, v);
    }
    headers.set(TENANT_HEADER, tenant.id);
    if (config.gatewaySecret) headers.set(GATEWAY_TOKEN_HEADER, config.gatewaySecret);

    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const response = await deps.graphql(new Request(`http://gateway${url.pathname}${url.search}`, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined }));
    res.statusCode = response.status;
    response.headers.forEach((v, k) => {
      if (k !== 'content-length' && k !== 'transfer-encoding') res.setHeader(k, v);
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}

function resolveTenant(req: IncomingMessage, tenants: TenantLookup, trustedBff: boolean, trustProxy: boolean): TenantConfig | undefined {
  if (trustedBff) {
    const id = header(req, TENANT_HEADER);
    if (id) {
      const t = tenants.get(id);
      return t?.status === 'live' ? t : undefined;
    }
  }
  const host = (trustProxy && header(req, 'x-forwarded-host')) || header(req, 'host');
  return tenants.resolveHost(host);
}

function originAllowed(origin: string, tenant: TenantConfig): boolean {
  try {
    const host = normalizeHost(new URL(origin).host);
    return tenant.domains.some((d) => normalizeHost(d) === host);
  } catch {
    return false;
  }
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = trustProxy ? header(req, 'x-forwarded-for')?.split(',')[0]?.trim() : undefined;
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

const MAX_BODY_BYTES = 256 * 1024;

function readBody(req: EdgeRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function graphqlError(res: ServerResponse, status: number, code: string, message: string): void {
  send(res, status, { errors: [{ message, extensions: { code } }] });
}
