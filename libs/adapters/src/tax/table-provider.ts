import { Money } from '@lightshop/domain-kernel';
import { TaxLine, TaxProvider, TaxResult } from './tax-provider';

export interface TaxRule {
  /** "IN", "US-CA", "DE" — most specific match wins. */
  jurisdiction: string;
  rate: number;
  inclusive: boolean;
  /** Overrides by tax code, e.g. { food: 0.05 }. */
  byTaxCode?: Record<string, number>;
}

/** Self-hosted rate table. Good enough to launch; swap for an engine when nexus gets complex. */
export class TableTaxProvider implements TaxProvider {
  readonly id = 'table';

  constructor(private readonly rules: TaxRule[]) {}

  async calculate(input: { tenantId: string; shipTo: { countryCode: string; adminArea?: string }; lines: TaxLine[] }): Promise<TaxResult> {
    const { countryCode, adminArea } = input.shipTo;
    const rule =
      (adminArea && this.rules.find((r) => r.jurisdiction === `${countryCode}-${adminArea}`)) ||
      this.rules.find((r) => r.jurisdiction === countryCode);
    const currency = input.lines[0]?.amount.currency ?? 'USD';
    if (!rule) return { lines: [], total: Money.zero(currency), inclusive: false };

    const lines = input.lines.map((line) => {
      const rate = rule.byTaxCode?.[line.taxCode] ?? rule.rate;
      // Inclusive: tax = gross - gross / (1 + rate). Exclusive: tax = net * rate.
      const tax = rule.inclusive
        ? line.amount.subtract(line.amount.multiply(1 / (1 + rate)))
        : line.amount.multiply(rate);
      return { lineId: line.lineId, tax, rate, jurisdiction: rule.jurisdiction };
    });
    const total = lines.reduce((sum, l) => sum.add(l.tax), Money.zero(currency));
    return { lines, total, inclusive: rule.inclusive };
  }
}
