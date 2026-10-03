import '@lightshop/ui/styles.css';
import './storefront.css';
import { isRtl } from '@lightshop/domain-kernel';
import { themeToCss } from '@lightshop/tenancy';
import { StoreHeader } from '@lightshop/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { listPacks } from '../lib/catalog';
import { getStore } from '../lib/tenant';

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStore();
  if (!store) return { title: 'Store not found' };
  const { brand } = store.tenant;
  return {
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: brand.tagline,
    icons: brand.faviconUrl ? [{ url: brand.faviconUrl }] : undefined,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await getStore();
  if (!store) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }
  const { tenant, locale } = store;
  const packs = await listPacks(store).catch(() => []);
  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} data-tenant={tenant.id}>
      <head>
        {/* Tenant theme tokens → CSS variables. Sanitized in themeToCss. */}
        <style dangerouslySetInnerHTML={{ __html: themeToCss(tenant.theme) }} />
      </head>
      <body>
        <StoreHeader
          brandName={tenant.brand.name}
          logoUrl={tenant.brand.logoUrl}
          links={packs.map((p) => ({ href: `/c/${p.id}`, label: p.name }))}
        />
        <main className="ls-container sf-main">{children}</main>
        <footer className="sf-footer">
          <div className="ls-container">
            © {new Date().getFullYear()} {tenant.brand.legal?.companyName ?? tenant.brand.name}
            {tenant.brand.supportEmail && (
              <>
                {' · '}
                <a href={`mailto:${tenant.brand.supportEmail}`}>{tenant.brand.supportEmail}</a>
              </>
            )}
          </div>
        </footer>
      </body>
    </html>
  );
}
