import { describe, expect, it } from 'vitest';
import { parseSubgraphs } from './config';
import { InMemoryRateLimiter } from './rate-limiter';

describe('InMemoryRateLimiter', () => {
  it('allows bursts up to the limit, then refills over time', () => {
    let now = 0;
    const rl = new InMemoryRateLimiter(60, () => now);
    for (let i = 0; i < 60; i++) expect(rl.take('k')).toBe(0);
    expect(rl.take('k')).toBe(1);
    now += 1000;
    expect(rl.take('k')).toBe(0);
    expect(rl.take('other')).toBe(0);
  });
});

describe('parseSubgraphs', () => {
  it('parses name=url pairs and rejects malformed ones', () => {
    expect(parseSubgraphs('catalog=http://c/graphql, orders=http://o/graphql')).toEqual([
      { name: 'catalog', url: 'http://c/graphql' },
      { name: 'orders', url: 'http://o/graphql' },
    ]);
    expect(() => parseSubgraphs('catalog')).toThrow(/name=url/);
  });
});
