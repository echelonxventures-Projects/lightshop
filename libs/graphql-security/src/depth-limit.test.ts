import { buildSchema, parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { depthLimit } from './depth-limit';

const schema = buildSchema(`type Node { id: ID! child: Node } type Query { root: Node }`);
const errors = (q: string, max = 3) => validate(schema, parse(q), [depthLimit(max)]).map((e) => e.message);

describe('depthLimit', () => {
  it('allows queries within the limit', () => {
    expect(errors('{ root { child { id } } }')).toEqual([]);
  });

  it('rejects deep queries, including through fragments', () => {
    expect(errors('{ root { child { child { id } } } }')).toEqual(['Query depth 4 exceeds the limit of 3']);
    expect(errors('query { root { ...F } } fragment F on Node { child { child { id } } }')).toHaveLength(1);
  });

  it('ignores introspection fields and survives fragment cycles', () => {
    expect(errors('{ __schema { types { fields { type { ofType { name } } } } } }')).toEqual([]);
    expect(() => errors('query { root { ...A } } fragment A on Node { child { ...A } }')).not.toThrow();
  });
});
