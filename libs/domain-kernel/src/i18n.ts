/** A string translated into many locales, e.g. product titles and category names. */
export type LocalizedText = Record<string, string>;

/**
 * Resolve the best translation: exact locale, then language-only, then the fallback chain,
 * then any available value. Never returns undefined for non-empty input.
 */
export function localize(text: LocalizedText, locale: string, fallbacks: string[] = ['en']): string {
  const candidates = [locale, locale.split('-')[0] ?? locale, ...fallbacks];
  for (const c of candidates) {
    const hit = text[c];
    if (hit) return hit;
  }
  return Object.values(text)[0] ?? '';
}

export function isRtl(locale: string): boolean {
  return ['ar', 'he', 'fa', 'ur', 'ps', 'yi'].includes(locale.split('-')[0] ?? '');
}
