import { ASTVisitor, FragmentDefinitionNode, GraphQLError, Kind, SelectionSetNode, ValidationContext } from 'graphql';

/**
 * Rejects operations nested deeper than `max` (fragments expanded, introspection fields ignored).
 * Paired with Apollo's parse-time `maxTokens`, this bounds the cost of any single request.
 */
export function depthLimit(max: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const def of context.getDocument().definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION) fragments.set(def.name.value, def);
    }

    const measure = (set: SelectionSetNode | undefined, depth: number, seen: Set<string>): number => {
      if (!set) return depth;
      let deepest = depth;
      for (const sel of set.selections) {
        if (sel.kind === Kind.FIELD) {
          if (sel.name.value.startsWith('__')) continue;
          deepest = Math.max(deepest, measure(sel.selectionSet, depth + 1, seen));
        } else if (sel.kind === Kind.INLINE_FRAGMENT) {
          deepest = Math.max(deepest, measure(sel.selectionSet, depth, seen));
        } else {
          const name = sel.name.value;
          const frag = fragments.get(name);
          if (frag && !seen.has(name)) deepest = Math.max(deepest, measure(frag.selectionSet, depth, new Set(seen).add(name)));
        }
      }
      return deepest;
    };

    return {
      OperationDefinition(node) {
        const depth = measure(node.selectionSet, 0, new Set());
        if (depth > max) {
          context.reportError(
            new GraphQLError(`Query depth ${depth} exceeds the limit of ${max}`, { nodes: [node], extensions: { code: 'QUERY_TOO_DEEP' } }),
          );
        }
      },
    };
  };
}
