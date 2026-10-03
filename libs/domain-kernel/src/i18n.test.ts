import { describe, expect, it } from 'vitest';
import { isRtl, localize } from './i18n';
import { tenantContextFromHeaders } from './tenant-context';

describe('localize', () => {
  const t = { en: 'Shoes', 'pt-BR': 'Tênis', pt: 'Sapatos', hi: 'जूते' };
  it('prefers exact locale, then language, then fallback', () => {
    expect(localize(t, 'pt-BR')).toBe('Tênis');
    expect(localize(t, 'pt-PT')).toBe('Sapatos');
    expect(localize(t, 'de-DE')).toBe('Shoes');
    expect(localize({ hi: 'जूते' }, 'de')).toBe('जूते');
  });
  it('detects RTL', () => {
    expect(isRtl('ar-SA')).toBe(true);
    expect(isRtl('en-US')).toBe(false);
  });
});

describe('tenantContextFromHeaders', () => {
  const defaults = { region: 'us', locale: 'en-US', currency: 'USD' };
  it('requires a tenant', () => {
    expect(() => tenantContextFromHeaders({}, defaults)).toThrow(/x-tenant-id/);
  });
  it('reads headers with defaults', () => {
    const ctx = tenantContextFromHeaders({ 'x-tenant-id': 't1', 'accept-language': 'fr-FR,fr;q=0.9' }, defaults);
    expect(ctx).toMatchObject({ tenantId: 't1', region: 'us', locale: 'fr-FR', currency: 'USD' });
  });
});
