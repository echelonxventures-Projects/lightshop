import { describe, expect, it } from 'vitest';
import { Money } from '@lightshop/domain-kernel';
import { Product } from './product';

const make = () =>
  Product.create({ tenantId: 't', region: 'us', vertical: 'general', titles: { en: 'Mug' }, categoryPath: [], attributes: {}, status: 'ACTIVE' });

const offer = (sellerId: string, price: string, stock = 5, condition: 'NEW' | 'USED' = 'NEW') => ({
  sellerId, sku: `sku-${sellerId}`, price: Money.of(price, 'USD'), stock, condition, moq: 1,
});

describe('Product.buyBox', () => {
  it('picks the cheapest in-stock NEW offer even when a used one is cheaper', () => {
    const p = make();
    p.addOffer(offer('a', '10.00', 0));
    p.addOffer(offer('b', '12.00'));
    p.addOffer(offer('c', '9.00', 3, 'USED'));
    p.addOffer(offer('d', '11.00'));
    expect(p.buyBox()?.sellerId).toBe('d');
  });

  it('falls back to used offers when no NEW offer is in stock', () => {
    const p = make();
    p.addOffer(offer('a', '10.00', 0));
    p.addOffer(offer('b', '9.00', 2, 'USED'));
    expect(p.buyBox()?.sellerId).toBe('b');
  });

  it('returns undefined when nothing is in stock', () => {
    const p = make();
    p.addOffer(offer('a', '10.00', 0));
    expect(p.buyBox()).toBeUndefined();
  });
});

describe('Product.addOffer', () => {
  it('rejects duplicates, mixed currencies and bad values', () => {
    const p = make();
    p.addOffer(offer('a', '10.00'));
    expect(() => p.addOffer(offer('a', '9.00'))).toThrow(/already has an offer/);
    expect(() => p.addOffer({ ...offer('b', '1'), price: Money.of('1', 'EUR') })).toThrow(/share a currency/);
    expect(() => p.addOffer({ ...offer('c', '1'), moq: 0 })).toThrow(/MOQ/);
    expect(() => p.addOffer(offer('d', '0'))).toThrow(/positive/);
    expect(p.version).toBe(2);
  });
});
