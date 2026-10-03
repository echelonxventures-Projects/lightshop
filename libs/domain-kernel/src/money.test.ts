import { describe, expect, it } from 'vitest';
import { Money } from './money';

describe('Money', () => {
  it('parses decimals without float drift', () => {
    expect(Money.of('0.1', 'USD').add(Money.of('0.2', 'USD')).toDecimal()).toBe('0.30');
    expect(Money.of('1999', 'JPY').amountMinor).toBe(1999);
    expect(Money.of('1.234', 'KWD').amountMinor).toBe(1234);
  });

  it('rejects precision beyond the currency minor unit', () => {
    expect(() => Money.of('1.5', 'JPY')).toThrow();
    expect(() => Money.of('1.999', 'USD')).toThrow();
  });

  it('rejects cross-currency arithmetic', () => {
    expect(() => Money.of('1', 'USD').add(Money.of('1', 'EUR'))).toThrow(/mismatch/);
  });

  it('allocates without losing minor units', () => {
    const parts = Money.of('100.00', 'USD').allocate([1, 1, 1]);
    expect(parts.map((p) => p.toDecimal())).toEqual(['33.34', '33.33', '33.33']);
    expect(parts.reduce((a, b) => a.add(b)).toDecimal()).toBe('100.00');
  });

  it('handles negatives and formatting', () => {
    expect(Money.of('-5.05', 'EUR').toDecimal()).toBe('-5.05');
    expect(Money.of('1234.5', 'INR').format('en-IN')).toBe('₹1,234.50');
  });

  it('multiplies with half-away-from-zero rounding', () => {
    expect(Money.of('10.00', 'USD').multiply(0.155).toDecimal()).toBe('1.55');
    expect(Money.ofMinor(-5, 'USD').multiply(0.5).amountMinor).toBe(-3);
  });
});
