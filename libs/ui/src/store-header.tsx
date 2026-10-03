import type { ReactNode } from 'react';

export interface StoreHeaderProps {
  brandName: string;
  logoUrl?: string;
  links: Array<{ href: string; label: string }>;
  /** Right-aligned slot, e.g. sign-in / account links. */
  actions?: ReactNode;
}

/** Brand comes entirely from TenantConfig, so nothing in here names a specific store. */
export function StoreHeader({ brandName, logoUrl, links, actions }: StoreHeaderProps) {
  return (
    <header className="ls-header">
      <div className="ls-container ls-header__inner">
        <a className="ls-header__brand" href="/">
          {logoUrl ? (
            <img src={logoUrl} alt="" width={32} height={32} />
          ) : (
            <span className="ls-header__logo" aria-hidden="true">{brandName.charAt(0)}</span>
          )}
          {brandName}
        </a>
        <nav className="ls-header__nav" aria-label="Categories">
          {links.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
        {actions && <div className="ls-header__actions">{actions}</div>}
      </div>
    </header>
  );
}
