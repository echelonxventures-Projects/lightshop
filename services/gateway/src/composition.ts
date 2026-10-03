import { GATEWAY_TOKEN_HEADER } from '@lightshop/auth';
import { composeServices } from '@theguild/federation-composition';
import { parse } from 'graphql';
import { Subgraph } from './config';

/** Fetch each subgraph's SDL via the Federation `_service { sdl }` contract. */
export async function fetchSubgraphSdl(subgraph: Subgraph, gatewaySecret?: string): Promise<string> {
  const res = await fetch(subgraph.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(gatewaySecret ? { [GATEWAY_TOKEN_HEADER]: gatewaySecret } : {}) },
    body: JSON.stringify({ query: '{ _service { sdl } }' }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as { data?: { _service?: { sdl?: string } }; errors?: Array<{ message: string }> };
  const sdl = body.data?._service?.sdl;
  if (!sdl) throw new Error(`Subgraph "${subgraph.name}" returned no SDL: ${body.errors?.map((e) => e.message).join('; ') ?? res.status}`);
  return sdl;
}

/**
 * Composes the supergraph with The Guild's MIT-licensed composer (Apollo Federation v2 spec).
 * Composition errors fail loudly: a bad subgraph deploy must never silently break the public API.
 */
export async function composeSupergraph(subgraphs: Subgraph[], gatewaySecret?: string): Promise<string> {
  const services = await Promise.all(
    subgraphs.map(async (s) => ({ name: s.name, url: s.url, typeDefs: parse(await fetchSubgraphSdl(s, gatewaySecret)) })),
  );
  const result = composeServices(services);
  if (result.errors?.length || !result.supergraphSdl) {
    const messages = result.errors?.map((e) => e.message) ?? ['no supergraph produced'];
    throw new Error(`Supergraph composition failed:\n  - ${messages.join('\n  - ')}`);
  }
  return result.supergraphSdl;
}
