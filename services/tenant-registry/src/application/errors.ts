export type RegistryErrorCode = 'NOT_FOUND' | 'VALIDATION_FAILED' | 'CONFLICT' | 'UNAUTHENTICATED' | 'FORBIDDEN';

export class RegistryError extends Error {
  constructor(
    readonly code: RegistryErrorCode,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    // Stable error type name: Temporal retry policies list it as non-retryable.
    this.name = 'RegistryError';
  }
}
