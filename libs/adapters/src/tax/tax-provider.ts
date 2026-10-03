import { Address, Money } from '@lightshop/domain-kernel';

export interface TaxLine {
  lineId: string;
  amount: Money;
  /** Product tax code from the vertical pack (e.g. "food", "apparel", "digital"). */
  taxCode: string;
}

export interface TaxResult {
  lines: Array<{ lineId: string; tax: Money; rate: number; jurisdiction: string }>;
  total: Money;
  /** Prices in VAT/GST regions are often tax-inclusive. */
  inclusive: boolean;
}

/** Port for tax engines (table-based, Avalara, Vertex, TaxJar, Fonoa, …). */
export interface TaxProvider {
  readonly id: string;
  calculate(input: { tenantId: string; shipTo: Address; lines: TaxLine[] }): Promise<TaxResult>;
}
