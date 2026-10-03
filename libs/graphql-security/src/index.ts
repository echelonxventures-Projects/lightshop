export * from './depth-limit';

/** Defaults applied at the gateway and in every subgraph (ADR-0009). */
export const GRAPHQL_LIMITS = { maxDepth: 12, maxTokens: 5000 } as const;
