import { describe, expect, it } from 'vitest';
import { Money } from '@lightshop/domain-kernel';
import { AdapterRegistry, InMemoryEventBus, ManualPaymentProvider, PaymentProvider, TableTaxProvider } from './index';

describe('AdapterRegistry', () => {
  it('resolves by id and lists alternatives when missing', () => {
    const reg = new AdapterRegistry<PaymentProvider>('payments').register('manual', () => new ManualPaymentProvider());
    expect(reg.get('manual')).toBe(reg.get('manual'));
    expect(() => reg.get('stripe')).toThrow(/Registered: manual/);
  });
});

describe('ManualPaymentProvider', () => {
  it('is idempotent and enforces refund rules', async () => {
    const p = new ManualPaymentProvider();
    const input = { tenantId: 't', orderId: 'ord_1', amount: Money.of('50', 'INR'), method: 'cod', idempotencyKey: 'k1' };
    const a = await p.createIntent(input);
    expect(await p.createIntent(input)).toBe(a);
    await expect(p.refund(a.id, Money.of('1', 'INR'), 'r1')).rejects.toThrow(/captured/);
    await p.capture(a.id);
    await expect(p.refund(a.id, Money.of('51', 'INR'), 'r2')).rejects.toThrow(/exceeds/);
    expect((await p.refund(a.id, Money.of('50', 'INR'), 'r3')).status).toBe('refunded');
  });
});

describe('TableTaxProvider', () => {
  const tax = new TableTaxProvider([
    { jurisdiction: 'IN', rate: 0.18, inclusive: true, byTaxCode: { food: 0.05 } },
    { jurisdiction: 'US-CA', rate: 0.0725, inclusive: false },
  ]);

  it('computes inclusive GST with per-code overrides', async () => {
    const r = await tax.calculate({
      tenantId: 't',
      shipTo: { countryCode: 'IN' },
      lines: [
        { lineId: 'a', amount: Money.of('118', 'INR'), taxCode: 'general' },
        { lineId: 'b', amount: Money.of('105', 'INR'), taxCode: 'food' },
      ],
    });
    expect(r.lines.map((l) => l.tax.toDecimal())).toEqual(['18.00', '5.00']);
    expect(r.inclusive).toBe(true);
  });

  it('computes exclusive US sales tax by state and returns zero when no rule', async () => {
    const ca = await tax.calculate({ tenantId: 't', shipTo: { countryCode: 'US', adminArea: 'CA' }, lines: [{ lineId: 'a', amount: Money.of('100', 'USD'), taxCode: 'general' }] });
    expect(ca.total.toDecimal()).toBe('7.25');
    const tx = await tax.calculate({ tenantId: 't', shipTo: { countryCode: 'US', adminArea: 'TX' }, lines: [{ lineId: 'a', amount: Money.of('100', 'USD'), taxCode: 'general' }] });
    expect(tx.total.isZero()).toBe(true);
  });
});

describe('InMemoryEventBus', () => {
  it('delivers to subscribers', async () => {
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    await bus.subscribe('t', 'g', async (e) => void seen.push(e.type));
    await bus.publish('t', [{ id: '1', type: 'x.created', tenantId: 't', region: 'us', aggregateId: 'a', occurredAt: '', version: 1, payload: {} }]);
    expect(seen).toEqual(['x.created']);
  });
});
