/** DI tokens. Constructor params always use explicit @Inject(token) so no emitDecoratorMetadata is required. */
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
export const OUTBOX_STORE = Symbol('OUTBOX_STORE');
export const EVENT_BUS = Symbol('EVENT_BUS');
export const TENANT_REGISTRY = Symbol('TENANT_REGISTRY');
export const VERTICAL_PACKS = Symbol('VERTICAL_PACKS');
export const OUTBOX_RELAY = Symbol('OUTBOX_RELAY');
export const CONFIG = Symbol('CONFIG');
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
