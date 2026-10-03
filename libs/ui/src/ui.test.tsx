import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LinkButton, ProductCard, StoreHeader } from './index';

describe('ui', () => {
  it('renders the tenant brand, never a hard-coded one', () => {
    const html = renderToStaticMarkup(<StoreHeader brandName="Verde Wholesale" links={[{ href: '/c/industrial', label: 'Industrial' }]} />);
    expect(html).toContain('Verde Wholesale');
    expect(html).toContain('href="/c/industrial"');
    expect(html.toLowerCase()).not.toContain('lightshop');
  });

  it('renders product cards with and without a price', () => {
    expect(renderToStaticMarkup(<ProductCard href="/p/1" title="Bolts" price="₹2,390.00" meta="MOQ 25" />)).toContain('MOQ 25');
    expect(renderToStaticMarkup(<ProductCard href="/p/2" title="Gone" />)).toContain('Currently unavailable');
  });

  it('composes button classes', () => {
    expect(renderToStaticMarkup(<LinkButton href="/x" variant="secondary" block>Go</LinkButton>)).toContain('ls-button ls-button--secondary ls-button--block');
  });
});
