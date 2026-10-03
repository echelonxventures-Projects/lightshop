import { Money } from '@lightshop/domain-kernel';
import { TestDatabase, createTestDatabase, integration } from '@lightshop/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Product } from '../src/domain/product';
import { PostgresProductRepository } from '../src/infrastructure/postgres-product-repository';
import { OutboxMessage } from '@lightshop/outbox';

const BASE_URL = integration('TEST_DATABASE_URL');

const product = (tenantId: string, id: string, vertical = 'general') =>
  Product.create({ id, tenantId, region: 'us', vertical, titles: { en: `P ${id}` }, categoryPath: ['A'], attributes: { brand: 'B' }, status: 'ACTIVE' });

const event = (tenantId: string, aggregateId: string, type = 'test.happened') => ({
  topic: 'catalog.product.v1',
  event: { id: `evt_${aggregateId}_${type}`, type, tenantId, region: 'us', aggregateId, occurredAt: new Date().toISOString(), version: 1, payload: {} },
});

describe.skipIf(!BASE_URL)('PostgresProductRepository (integration)', () => {
  let db: TestDatabase;
  let repo: PostgresProductRepository;

  beforeAll(async () => {
    db = await createTestDatabase(BASE_URL!);
    repo = await PostgresProductRepository.connect(db.url);
  });

  afterAll(async () => {
    await repo?.close();
    await db?.drop();
  });

  it('round-trips a product with offers and money exactly', async () => {
    const p = product('t1', 'prd_rt');
    p.addOffer({ sellerId: 's1', sku: 'A', price: Money.of('1234.56', 'USD'), stock: 3, condition: 'NEW', moq: 1 });
    p.addOffer({ sellerId: 's2', sku: 'B', price: Money.of('999.99', 'USD'), stock: 0, condition: 'USED', moq: 2 });
    await repo.save(p, []);
    const loaded = await repo.findById('t1', 'prd_rt');
    const offers = loaded!.offers.map((o) => [o.sellerId, o.price.toDecimal(), o.stock, o.moq]);
    expect(offers).toHaveLength(2);
    expect(offers).toEqual(expect.arrayContaining([['s1', '1234.56', 3, 1], ['s2', '999.99', 0, 2]]));
    expect(loaded?.buyBox()?.sellerId).toBe('s1');
    expect(loaded?.version).toBe(3);
  });

  it('isolates tenants even when ids collide', async () => {
    await repo.save(product('tenant-a', 'prd_same'), []);
    await repo.save(product('tenant-b', 'prd_same', 'fashion'), []);
    expect((await repo.findById('tenant-a', 'prd_same'))?.vertical).toBe('general');
    expect((await repo.findById('tenant-b', 'prd_same'))?.vertical).toBe('fashion');
    expect(await repo.findById('tenant-c', 'prd_same')).toBeUndefined();
  });

  it('paginates by (created_at, id) and filters by vertical', async () => {
    for (let i = 0; i < 5; i++) await repo.save(product('pag', `prd_p${i}`, i % 2 ? 'fashion' : 'general'), []);
    const first = await repo.list('pag', { first: 2 });
    expect(first.hasNextPage).toBe(true);
    const { encodeCursor } = await import('../src/infrastructure/product-repository');
    const rest = await repo.list('pag', { first: 10, after: encodeCursor(first.items.at(-1)!) });
    const ids = [...first.items, ...rest.items].map((p) => p.id);
    expect(new Set(ids).size).toBe(5);
    expect(rest.hasNextPage).toBe(false);
    expect((await repo.list('pag', { first: 10, vertical: 'fashion' })).items).toHaveLength(2);
    expect(await repo.count('pag')).toBe(5);
  });

  it('never lets a stale write overwrite a newer version', async () => {
    const p = product('ver', 'prd_v');
    await repo.save(p, []);
    const stale = (await repo.findById('ver', 'prd_v'))!;
    const fresh = (await repo.findById('ver', 'prd_v'))!;
    fresh.addOffer({ sellerId: 's', sku: 'x', price: Money.of('5', 'USD'), stock: 1, condition: 'NEW', moq: 1 });
    await repo.save(fresh, []);
    await repo.save(Product.rehydrate({ ...stale.toProps(), titles: { en: 'STALE' } }), []);
    expect((await repo.findById('ver', 'prd_v'))?.titles.en).toBe('P prd_v');
  });

  it('writes events atomically and drains them exactly once across concurrent relays', async () => {
    for (let i = 0; i < 20; i++) await repo.save(product('obx', `prd_o${i}`), [event('obx', `prd_o${i}`)]);
    const seen: string[] = [];
    const slowPublish = async (msgs: OutboxMessage[]) => {
      await new Promise((r) => setTimeout(r, 50));
      seen.push(...msgs.map((m) => m.event.aggregateId));
    };
    const drainAll = async () => { while ((await repo.drain(5, slowPublish)) > 0); };
    await Promise.all([drainAll(), drainAll(), drainAll()]);
    const mine = seen.filter((id) => id.startsWith('prd_o'));
    expect(mine).toHaveLength(20);
    expect(new Set(mine).size).toBe(20);
    expect(await repo.pendingCount()).toBe(0);
  });

  it('keeps events pending when publishing fails (no loss)', async () => {
    await repo.save(product('fail', 'prd_f'), [event('fail', 'prd_f')]);
    await expect(repo.drain(10, async () => { throw new Error('broker down'); })).rejects.toThrow('broker down');
    expect(await repo.pendingCount()).toBe(1);
    expect(await repo.drain(10, async () => undefined)).toBe(1);
    expect(await repo.pendingCount()).toBe(0);
  });
});
