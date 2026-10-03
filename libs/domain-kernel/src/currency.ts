/** ISO 4217 currencies whose minor unit is not 2. Everything else defaults to 2. */
const MINOR_UNITS: Record<string, number> = {
  BHD: 3, CLP: 0, IDR: 0, ISK: 0, JOD: 3, JPY: 0, KRW: 0, KWD: 3,
  OMR: 3, TND: 3, UGX: 0, VND: 0, XAF: 0, XOF: 0,
};

export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };

export function currency(code: string): CurrencyCode {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) {
    throw new Error(`Invalid ISO 4217 currency code: ${code}`);
  }
  return upper as CurrencyCode;
}

export function minorUnits(code: CurrencyCode): number {
  return MINOR_UNITS[code] ?? 2;
}
