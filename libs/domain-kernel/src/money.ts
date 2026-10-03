import { CurrencyCode, currency, minorUnits } from './currency';

/**
 * Immutable monetary amount stored as an integer number of minor units (cents, paise…)
 * to avoid floating-point drift. Arithmetic across currencies is rejected — convert via FX first.
 */
export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currency: CurrencyCode,
  ) {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new Error(`Money amount must be a safe integer of minor units, got ${amountMinor}`);
    }
  }

  static ofMinor(amountMinor: number, code: string): Money {
    return new Money(amountMinor, currency(code));
  }

  /** Parse a decimal string ("19.99") into minor units without float math. */
  static of(decimal: string | number, code: string): Money {
    const cur = currency(code);
    const digits = minorUnits(cur);
    const str = typeof decimal === 'number' ? decimal.toFixed(digits) : decimal.trim();
    const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(str);
    if (!match) throw new Error(`Invalid decimal amount: ${decimal}`);
    const [, sign, whole, fraction = ''] = match;
    if (fraction.length > digits) {
      throw new Error(`${cur} supports ${digits} decimal places, got "${str}"`);
    }
    const minor = Number(whole + fraction.padEnd(digits, '0'));
    return new Money(sign ? -minor : minor, cur);
  }

  static zero(code: string): Money {
    return new Money(0, currency(code));
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  /** Multiply by a quantity or rate, rounding half away from zero. */
  multiply(factor: number): Money {
    const raw = this.amountMinor * factor;
    return new Money(Math.sign(raw) * Math.round(Math.abs(raw)), this.currency);
  }

  /**
   * Split into parts proportional to `ratios` without losing a single minor unit.
   * Used for multi-seller cart splits, commission vs. payout, partial refunds.
   */
  allocate(ratios: number[]): Money[] {
    const total = ratios.reduce((a, b) => a + b, 0);
    if (ratios.length === 0 || total <= 0 || ratios.some((r) => r < 0)) {
      throw new Error('allocate() needs non-negative ratios with a positive sum');
    }
    const shares = ratios.map((r) => Math.floor((this.amountMinor * r) / total));
    let remainder = this.amountMinor - shares.reduce((a, b) => a + b, 0);
    for (let i = 0; remainder > 0; i = (i + 1) % shares.length, remainder--) {
      shares[i] = (shares[i] ?? 0) + 1;
    }
    return shares.map((s) => new Money(s, this.currency));
  }

  isZero(): boolean {
    return this.amountMinor === 0;
  }

  isNegative(): boolean {
    return this.amountMinor < 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return Math.sign(this.amountMinor - other.amountMinor) as -1 | 0 | 1;
  }

  /** Decimal string, e.g. "19.99". */
  toDecimal(): string {
    const digits = minorUnits(this.currency);
    const abs = Math.abs(this.amountMinor).toString().padStart(digits + 1, '0');
    const whole = digits ? abs.slice(0, -digits) : abs;
    const fraction = digits ? `.${abs.slice(-digits)}` : '';
    return `${this.amountMinor < 0 ? '-' : ''}${whole}${fraction}`;
  }

  format(locale: string): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: this.currency }).format(
      Number(this.toDecimal()),
    );
  }

  toJSON(): { amount: string; currency: string } {
    return { amount: this.toDecimal(), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
