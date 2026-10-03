import { TenantConfig } from './tenant-config';
import { TenantRegistry, TenantSource } from './registry';

/** Read side every consumer depends on; implemented by static and live registries. */
export interface TenantLookup {
  get(id: string): TenantConfig | undefined;
  resolveHost(hostHeader: string | null | undefined): TenantConfig | undefined;
  all(): TenantConfig[];
}

export interface LiveRegistryOptions {
  intervalMs?: number;
  onError?: (err: Error) => void;
  onChange?: (registry: TenantRegistry) => void;
}

/**
 * Keeps an always-valid TenantRegistry in memory and refreshes it from a source in the background.
 * A refresh that fails (network, invalid config, domain conflict) keeps serving the last good
 * snapshot, so a bad edit in the admin console can never take stores offline.
 */
export class LiveTenantRegistry implements TenantLookup {
  private current: TenantRegistry;
  private timer?: NodeJS.Timeout;

  private constructor(
    private readonly source: TenantSource,
    initial: TenantRegistry,
    private readonly options: LiveRegistryOptions,
  ) {
    this.current = initial;
  }

  /** Initial load must succeed: a service should not start without knowing its tenants. */
  static async start(source: TenantSource, options: LiveRegistryOptions = {}): Promise<LiveTenantRegistry> {
    const live = new LiveTenantRegistry(source, await TenantRegistry.load(source), options);
    if (options.intervalMs && options.intervalMs > 0) {
      live.timer = setInterval(() => void live.refresh(), options.intervalMs);
      live.timer.unref();
    }
    return live;
  }

  /** Returns true if a new snapshot was applied. */
  async refresh(): Promise<boolean> {
    try {
      const configs = await this.source.list();
      if (configs === NOT_MODIFIED) return false;
      this.current = new TenantRegistry(configs);
      this.options.onChange?.(this.current);
      return true;
    } catch (err) {
      this.options.onError?.(err as Error);
      return false;
    }
  }

  stop(): void {
    clearInterval(this.timer);
  }

  get(id: string) { return this.current.get(id); }
  resolveHost(host: string | null | undefined) { return this.current.resolveHost(host); }
  all() { return this.current.all(); }
}

/** Sentinel a source may return when nothing changed since the last call (e.g. HTTP 304). */
export const NOT_MODIFIED = Object.freeze([]) as unknown as unknown[];
