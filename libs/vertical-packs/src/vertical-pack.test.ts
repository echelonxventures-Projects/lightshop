import { describe, expect, it } from 'vitest';
import { BUILT_IN_PACKS, VerticalPack, VerticalPackRegistry } from './vertical-pack';

describe('VerticalPackRegistry', () => {
  const reg = new VerticalPackRegistry();

  it('ships the built-in packs', () => {
    expect(reg.list().map((p) => p.id)).toEqual(['general', 'electronics', 'fashion', 'grocery', 'industrial', 'pharmacy']);
    expect(reg.list(['grocery'])).toHaveLength(1);
  });

  it('accepts valid attributes and applies defaults', () => {
    const attrs: Record<string, unknown> = { brand: 'Volt', model: 'X1', warrantyMonths: 12 };
    expect(reg.validate('electronics', attrs)).toEqual({ valid: true, errors: [] });
    expect(attrs.serialTracked).toBe(false);
  });

  it('reports missing, wrong and unknown attributes', () => {
    const r = reg.validate('fashion', { brand: 'Kora', gender: 'robot', size: 'M', sizeSystem: 'INT', color: 'red', wings: 2 });
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([expect.stringMatching(/gender/), expect.stringMatching(/unknown attribute "wings"/)]));
  });

  it('enforces B2B fields like MOQ and HS code', () => {
    expect(reg.validate('industrial', { brand: 'Ferro', manufacturerPartNumber: 'B-12', moq: 0, unitOfMeasure: 'box', hsCode: 'abc' }).errors).toHaveLength(2);
  });

  it('registers new industries at runtime (zero code)', () => {
    const jewelry: VerticalPack = {
      ...BUILT_IN_PACKS[0]!,
      id: 'jewelry',
      name: { en: 'Jewelry' },
      attributes: { type: 'object', properties: { metal: { type: 'string', enum: ['gold', 'silver'] }, purityKarat: { type: 'integer' } }, required: ['metal'] },
      facets: ['metal'],
      compliance: { requiresSellerLicense: true, restrictedRegions: ['xx'] },
    };
    reg.register(jewelry);
    expect(reg.validate('jewelry', { metal: 'gold', purityKarat: 22 }).valid).toBe(true);
    expect(reg.isAllowedIn('jewelry', 'xx')).toBe(false);
    expect(() => reg.register(jewelry)).toThrow(/must be newer/);
  });

  it('rejects packs whose facets are not attributes', () => {
    expect(() => new VerticalPackRegistry([{ ...BUILT_IN_PACKS[0]!, facets: ['nope'] }])).toThrow(/facet "nope"/);
  });
});
