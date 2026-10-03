const ACRONYMS = new Set(['moq', 'hs', 'ram', 'gb', 'sku', 'imei', 'uri', 'url']);

/** "warrantyMonths" → "Warranty months", "hsCode" → "HS code". Labels move to pack i18n metadata later. */
export function humanize(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
  const text = words.map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w)).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
