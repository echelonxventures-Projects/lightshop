export type CatalogErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN_VERTICAL'
  | 'UNSUPPORTED_CURRENCY'
  | 'TENANT_NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN';

/** Application errors carry a stable machine-readable code mapped to GraphQL extensions. */
export class CatalogError extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}
