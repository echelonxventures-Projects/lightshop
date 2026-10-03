import { Roles } from '@lightshop/auth';
import { TenantRegistry } from '@lightshop/tenancy';
import { CatalogService, AddOfferCommand, CreateProductCommand } from './application/catalog.service';
import { RequestContext } from './application/request-context';

type SeedProduct = CreateProductCommand & { id: string; offers: AddOfferCommand[] };

/** Demo data per tenant. Every product is validated against its vertical pack like real input. */
const DEMO: Record<string, SeedProduct[]> = {
  'acme-mart': [
    {
      id: 'prd_demo_phone', vertical: 'electronics', categoryPath: ['Electronics', 'Phones'],
      titles: { en: 'Nova X2 Smartphone 128 GB', es: 'Smartphone Nova X2 128 GB', de: 'Nova X2 Smartphone 128 GB' },
      description: '6.4" OLED, 48 MP camera, two-day battery.',
      attributes: { brand: 'Nova', model: 'X2', warrantyMonths: 12, storageGb: 128, ramGb: 8, screenInches: 6.4 },
      offers: [
        { sellerId: 'sel_acme_1p', sku: 'NX2-128-BLK', price: '499.00', currency: 'USD', stock: 40 },
        { sellerId: 'sel_gadgetco', sku: 'GC-NX2-128', price: '479.00', currency: 'USD', stock: 12 },
        { sellerId: 'sel_renew', sku: 'RN-NX2-128', price: '389.00', currency: 'USD', stock: 3, condition: 'REFURBISHED' },
      ],
    },
    {
      id: 'prd_demo_tee', vertical: 'fashion', categoryPath: ['Fashion', 'Men', 'T-Shirts'],
      titles: { en: 'Everyday Organic Cotton Tee', es: 'Camiseta de algodón orgánico' },
      attributes: { brand: 'Kora', gender: 'men', size: 'M', sizeSystem: 'INT', color: 'Navy', fabric: '100% organic cotton', fit: 'regular' },
      offers: [{ sellerId: 'sel_kora', sku: 'KORA-TEE-NVY-M', price: '18.00', currency: 'USD', stock: 200 }],
    },
    {
      id: 'prd_demo_coffee', vertical: 'grocery', categoryPath: ['Grocery', 'Coffee'],
      titles: { en: 'Single-Origin Ground Coffee 500 g', de: 'Gemahlener Kaffee 500 g' },
      attributes: { brand: 'Highland', netQuantity: 500, unit: 'g', storage: 'ambient', shelfLifeDays: 270, dietary: ['vegan', 'organic'] },
      offers: [{ sellerId: 'sel_acme_1p', sku: 'HL-COF-500', price: '11.49', currency: 'USD', stock: 85 }],
    },
  ],
  'verde-wholesale': [
    {
      id: 'prd_demo_bolts', vertical: 'industrial', categoryPath: ['Hardware', 'Fasteners'],
      titles: { en: 'M8 Stainless Steel Hex Bolts (Box of 500)', hi: 'M8 स्टेनलेस स्टील हेक्स बोल्ट' },
      attributes: {
        brand: 'Ferro', manufacturerPartNumber: 'FR-M8-SS-500', moq: 10, unitOfMeasure: 'box', leadTimeDays: 7,
        certifications: ['ISO 9001', 'RoHS'], hsCode: '731815', originCountry: 'IN',
      },
      offers: [
        { sellerId: 'sel_ferro', sku: 'FR-M8-500', price: '2450.00', currency: 'INR', stock: 900 },
        { sellerId: 'sel_bharat_fast', sku: 'BF-M8-500', price: '2390.00', currency: 'INR', stock: 300, moq: 25 },
      ],
    },
    {
      id: 'prd_demo_polo', vertical: 'fashion', categoryPath: ['Apparel', 'Corporate Uniforms'],
      titles: { en: 'Custom Logo Polo Shirt (Bulk)', hi: 'कस्टम लोगो पोलो शर्ट' },
      attributes: { brand: 'Verde Basics', gender: 'unisex', size: 'L', sizeSystem: 'IN', color: 'Forest Green', fabric: 'Pique cotton' },
      offers: [{ sellerId: 'sel_tiruppur_knits', sku: 'TK-POLO-L', price: '310.00', currency: 'INR', stock: 5000, moq: 100 }],
    },
  ],
};

export async function seedDemoData(catalog: CatalogService, registry: TenantRegistry): Promise<number> {
  let created = 0;
  for (const tenant of registry.all()) {
    const products = DEMO[tenant.id];
    if (!products) continue;
    const ctx: RequestContext = {
      tenant, tenantId: tenant.id, region: tenant.regions[0]!, locale: tenant.locales[0]!, currency: tenant.currencies[0]!,
      // Internal system principal: seeding goes through the same authorization path as real writes.
      principal: { userId: 'system:seed', tenantId: tenant.id, roles: [Roles.CatalogAdmin] },
    };
    if ((await catalog.countProducts(ctx)) > 0) continue;
    for (const { id, offers, ...cmd } of products) {
      await catalog.createProduct(ctx, cmd, { id });
      for (const offer of offers) await catalog.addOffer(ctx, id, offer);
      created++;
    }
  }
  return created;
}
