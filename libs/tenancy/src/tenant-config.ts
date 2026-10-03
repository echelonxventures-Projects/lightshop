import { z } from 'zod';

/**
 * TenantConfig is the whole definition of a white-label store. Launching a new store means
 * adding one of these (JSON file today, tenant-registry service + admin UI later). No code change,
 * no deploy.
 */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB');

export const ThemeTokensSchema = z.object({
  colorPrimary: hexColor,
  colorOnPrimary: hexColor.default('#FFFFFF'),
  colorAccent: hexColor.optional(),
  colorBackground: hexColor.default('#FFFFFF'),
  colorSurface: hexColor.default('#F7F7F8'),
  colorText: hexColor.default('#111114'),
  colorTextMuted: hexColor.default('#5B5B66'),
  radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).default('md'),
  fontFamily: z.string().default('system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'),
  /** Optional dark palette; falls back to auto-derived defaults in the UI. */
  dark: z
    .object({ colorBackground: hexColor, colorSurface: hexColor, colorText: hexColor, colorTextMuted: hexColor })
    .partial()
    .optional(),
});

export const BusinessModelSchema = z.enum([
  'b2c-marketplace', // many sellers, consumer buyers (Amazon / Flipkart)
  'b2b-wholesale', //   RFQ, MOQ, tiered pricing, net terms (Alibaba)
  'first-party-retail', // own inventory, stores, BOPIS, grocery (Walmart)
  'd2c', //             single brand storefront
]);

/** Adapter IDs select implementations of ports in libs/adapters — never vendor SDKs directly. */
export const AdapterSelectionSchema = z.object({
  payments: z.array(z.string()).min(1).default(['manual']),
  tax: z.string().default('table'),
  search: z.string().default('postgres'),
  storage: z.string().default('s3-compatible'),
  auth: z.string().default('oidc'),
  notifications: z.array(z.string()).default(['smtp']),
  shipping: z.array(z.string()).default(['flat-rate']),
});

export const TenantConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'lowercase slug'),
  status: z.enum(['draft', 'live', 'suspended']).default('live'),
  brand: z.object({
    name: z.string().min(1),
    tagline: z.string().optional(),
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    supportEmail: z.string().email().optional(),
    legal: z
      .object({ termsUrl: z.string(), privacyUrl: z.string(), companyName: z.string() })
      .partial()
      .optional(),
  }),
  theme: ThemeTokensSchema,
  /** Hostnames that serve this tenant. First one is canonical. */
  domains: z.array(z.string().min(1)).min(1),
  /** Data residency: which regional cells hold this tenant's data. First one is home. */
  regions: z.array(z.string()).min(1),
  locales: z.array(z.string()).min(1),
  currencies: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1),
  businessModels: z.array(BusinessModelSchema).min(1),
  /** Vertical Pack IDs from libs/vertical-packs. */
  verticals: z.array(z.string()).min(1),
  adapters: AdapterSelectionSchema.default({}),
  features: z.record(z.string(), z.boolean()).default({}),
});

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type BusinessModel = z.infer<typeof BusinessModelSchema>;
export type TenantConfig = z.infer<typeof TenantConfigSchema>;
export type TenantConfigInput = z.input<typeof TenantConfigSchema>;

export function parseTenantConfig(input: unknown): TenantConfig {
  const result = TenantConfigSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid TenantConfig:\n  ${issues.join('\n  ')}`);
  }
  return result.data;
}

export function hasBusinessModel(tenant: TenantConfig, model: BusinessModel): boolean {
  return tenant.businessModels.includes(model);
}

export function isFeatureEnabled(tenant: TenantConfig, flag: string): boolean {
  return tenant.features[flag] ?? false;
}
