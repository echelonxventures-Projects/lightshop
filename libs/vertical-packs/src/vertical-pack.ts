import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import electronics from './packs/electronics.json';
import fashion from './packs/fashion.json';
import general from './packs/general.json';
import grocery from './packs/grocery.json';
import industrial from './packs/industrial.json';
import pharmacy from './packs/pharmacy.json';

export interface VerticalPack {
  id: string;
  name: Record<string, string>;
  version: number;
  defaultTaxCode: string;
  /** JSON Schema (draft 2020-12 compatible subset) for product attributes. */
  attributes: Record<string, unknown>;
  facets: string[];
  variantAxes: string[];
  compliance: {
    requiresSellerLicense: boolean;
    licenseTypes?: string[];
    restrictedRegions: string[];
    requiredDocuments?: string[];
    prescriptionVerification?: boolean;
  };
  fulfillment: Record<string, boolean>;
  returns: { returnable: boolean; windowDays: number } & Record<string, boolean | number>;
}

export const BUILT_IN_PACKS: VerticalPack[] = [general, electronics, fashion, grocery, industrial, pharmacy];

export interface AttributeValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validates product attributes against their pack's schema. New industries = new pack data,
 * registered at runtime (from the admin console or a tenant's private packs), no code change.
 */
export class VerticalPackRegistry {
  private readonly ajv = addFormats(new Ajv({ allErrors: true, useDefaults: true, strict: false }));
  private readonly packs = new Map<string, { pack: VerticalPack; validate: ValidateFunction }>();

  constructor(packs: VerticalPack[] = BUILT_IN_PACKS) {
    packs.forEach((p) => this.register(p));
  }

  register(pack: VerticalPack): void {
    const existing = this.packs.get(pack.id);
    if (existing && existing.pack.version >= pack.version) {
      throw new Error(`Pack ${pack.id} v${pack.version} must be newer than registered v${existing.pack.version}`);
    }
    for (const facet of pack.facets) {
      const props = (pack.attributes as { properties?: Record<string, unknown> }).properties ?? {};
      if (!(facet in props)) throw new Error(`Pack ${pack.id}: facet "${facet}" is not a declared attribute`);
    }
    this.packs.set(pack.id, { pack, validate: this.ajv.compile(pack.attributes) });
  }

  get(id: string): VerticalPack {
    const entry = this.packs.get(id);
    if (!entry) throw new Error(`Unknown vertical pack "${id}"`);
    return entry.pack;
  }

  list(ids?: string[]): VerticalPack[] {
    return [...this.packs.values()].map((e) => e.pack).filter((p) => !ids || ids.includes(p.id));
  }

  /** Validates in place: schema defaults are applied to `attributes`. */
  validate(packId: string, attributes: Record<string, unknown>): AttributeValidation {
    const entry = this.packs.get(packId);
    if (!entry) return { valid: false, errors: [`Unknown vertical pack "${packId}"`] };
    const valid = entry.validate(attributes) as boolean;
    return { valid, errors: valid ? [] : (entry.validate.errors ?? []).map(formatError) };
  }

  /** Whether a product of this pack may be listed in the given region. */
  isAllowedIn(packId: string, region: string): boolean {
    return !this.get(packId).compliance.restrictedRegions.includes(region);
  }
}

function formatError(e: ErrorObject): string {
  const path = e.instancePath.replace(/^\//, '').replace(/\//g, '.') || '(root)';
  if (e.keyword === 'additionalProperties') {
    return `${path}: unknown attribute "${(e.params as { additionalProperty: string }).additionalProperty}"`;
  }
  return `${path}: ${e.message}`;
}
