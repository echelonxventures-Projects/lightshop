/**
 * Maps adapter IDs (as written in TenantConfig.adapters) to implementations. Services register
 * what they ship; tenants pick by ID. Swapping a vendor is config, not code.
 */
export class AdapterRegistry<T> {
  private readonly factories = new Map<string, () => T>();
  private readonly instances = new Map<string, T>();

  constructor(private readonly port: string) {}

  register(id: string, factory: () => T): this {
    if (this.factories.has(id)) throw new Error(`${this.port} adapter "${id}" already registered`);
    this.factories.set(id, factory);
    return this;
  }

  get(id: string): T {
    const cached = this.instances.get(id);
    if (cached) return cached;
    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`No ${this.port} adapter "${id}". Registered: ${[...this.factories.keys()].join(', ') || 'none'}`);
    }
    const instance = factory();
    this.instances.set(id, instance);
    return instance;
  }

  ids(): string[] {
    return [...this.factories.keys()];
  }
}
