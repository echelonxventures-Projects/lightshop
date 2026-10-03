import { createTokenVerifier, GATEWAY_TOKEN_HEADER } from '@lightshop/auth';
import { depthLimit } from '@lightshop/graphql-security';
import { FileTenantSource, HttpTenantSource, LiveTenantRegistry } from '@lightshop/tenancy';
import { createGatewayRuntime, GatewayPlugin } from '@graphql-hive/gateway-runtime';
import { parse } from 'graphql';
import { createServer, Server } from 'node:http';
import { composeSupergraph } from './composition';
import { GatewayConfig } from './config';
import { createEdgeHandler } from './edge';
import { InMemoryRateLimiter } from './rate-limiter';

/** Headers the edge sets that must reach every subgraph. */
const PROPAGATED = ['x-tenant-id', GATEWAY_TOKEN_HEADER, 'authorization', 'accept-language', 'x-region', 'x-currency', 'traceparent', 'tracestate'];

/** Same cost controls as every subgraph (ADR-0009), enforced before planning/fan-out. */
function queryLimits(maxDepth: number, maxTokens: number): GatewayPlugin {
  return {
    onParse({ setParseFn }) {
      setParseFn((source, options) => parse(source, { ...options, maxTokens }));
    },
    onValidate({ addValidationRule }) {
      addValidationRule(depthLimit(maxDepth));
    },
  };
}

export interface RunningGateway {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export async function startGateway(config: GatewayConfig, log: (m: string) => void = console.log): Promise<RunningGateway> {
  const tenants = await LiveTenantRegistry.start(
    config.tenantsUrl
      ? new HttpTenantSource({ url: config.tenantsUrl, headers: config.gatewaySecret ? { [GATEWAY_TOKEN_HEADER]: config.gatewaySecret } : {} })
      : new FileTenantSource(config.tenantsDir),
    { intervalMs: config.tenantsRefreshMs, onError: (e) => log(`tenant refresh failed, keeping last good configs: ${e.message}`) },
  );

  // Compose once up front so a broken subgraph fails the deploy instead of the first request.
  const initial = await composeSupergraph(config.subgraphs, config.gatewaySecret);
  let supergraph = initial;

  const runtime = createGatewayRuntime({
    supergraph: async () => {
      try {
        supergraph = await composeSupergraph(config.subgraphs, config.gatewaySecret);
      } catch (err) {
        log(`supergraph refresh failed, serving last good composition: ${(err as Error).message}`);
      }
      return supergraph;
    },
    pollingInterval: config.supergraphRefreshMs,
    graphqlEndpoint: '/graphql',
    landingPage: false,
    graphiql: !config.production,
    maskedErrors: config.production,
    disableIntrospection: config.introspection ? undefined : { disableIf: () => true },
    propagateHeaders: {
      fromClientToSubgraphs: ({ request }) => Object.fromEntries(PROPAGATED.map((h) => [h, request.headers.get(h)])),
    },
    plugins: () => [queryLimits(config.maxDepth, config.maxTokens)],
  });

  const handler = createEdgeHandler({
    config,
    tenants,
    verifier: createTokenVerifier(config.auth),
    limiter: new InMemoryRateLimiter(config.rateLimitPerMinute),
    graphql: (request) => Promise.resolve(runtime.fetch(request)),
  });
  const server = createServer((req, res) => {
    handler(req, res).catch((err: Error) => {
      log(`edge error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(err.message.includes('too large') ? 413 : 500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ errors: [{ message: 'Request failed', extensions: { code: 'INTERNAL' } }] }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(config.port, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  return {
    server,
    url: `http://localhost:${port}`,
    async close() {
      tenants.stop();
      await runtime.dispose?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
