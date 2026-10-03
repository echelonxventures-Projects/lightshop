/**
 * Country-agnostic postal address. Field labels, ordering and validation per country
 * are driven by locale metadata in the UI, not by separate types.
 */
export interface Address {
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  /** State / province / prefecture / region code. */
  adminArea?: string;
  locality?: string;
  dependentLocality?: string;
  postalCode?: string;
  lines: string[];
  recipient?: string;
  organization?: string;
  phone?: string;
  geo?: { lat: number; lng: number };
}

export function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

export function assertAddress(address: Address): Address {
  if (!isValidCountryCode(address.countryCode)) {
    throw new Error(`Invalid ISO 3166-1 alpha-2 country code: ${address.countryCode}`);
  }
  if (address.lines.length === 0 || address.lines.every((l) => l.trim() === '')) {
    throw new Error('Address needs at least one non-empty line');
  }
  return address;
}
