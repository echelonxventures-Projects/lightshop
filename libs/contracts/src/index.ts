import { join } from 'node:path';

export * from './events';

/** Absolute path to a subgraph SDL file shipped with this package. */
export function schemaPath(name: 'catalog'): string {
  return join(__dirname, '..', 'schema', `${name}.graphql`);
}
