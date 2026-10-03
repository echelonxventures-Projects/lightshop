/** Port: swap the in-memory limiter for a shared one (Valkey/Redis) when running many gateway replicas. */
export interface RateLimiter {
  /** Returns 0 if allowed, otherwise seconds until the next request is allowed. */
  take(key: string): number;
}

/** Token bucket per key: `perMinute` sustained, bursts up to the same amount. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updated: number }>();

  constructor(
    private readonly perMinute: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 100_000,
  ) {}

  take(key: string): number {
    const now = this.now();
    const ratePerMs = this.perMinute / 60_000;
    const bucket = this.buckets.get(key) ?? { tokens: this.perMinute, updated: now };
    bucket.tokens = Math.min(this.perMinute, bucket.tokens + (now - bucket.updated) * ratePerMs);
    bucket.updated = now;
    if (this.buckets.size >= this.maxKeys && !this.buckets.has(key)) this.buckets.clear(); // bound memory under key floods
    this.buckets.set(key, bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }
    return Math.ceil((1 - bucket.tokens) / ratePerMs / 1000);
  }
}
