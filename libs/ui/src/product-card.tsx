import type { ReactNode } from 'react';
import { Price } from './price';

export interface ProductCardProps {
  href: string;
  title: string;
  price?: string;
  /** e.g. "3 sellers" or "MOQ 25". */
  meta?: string;
  badge?: ReactNode;
  imageUrl?: string;
}

export function ProductCard({ href, title, price, meta, badge, imageUrl }: ProductCardProps) {
  return (
    <a className="ls-card" href={href}>
      <div className="ls-card__media" aria-hidden="true">
        {imageUrl ? <img src={imageUrl} alt="" width="100%" /> : title.charAt(0).toUpperCase()}
      </div>
      {badge}
      <h3 className="ls-card__title">{title}</h3>
      {price ? <Price formatted={price} /> : <span className="ls-card__meta">Currently unavailable</span>}
      {meta && <p className="ls-card__meta">{meta}</p>}
    </a>
  );
}
