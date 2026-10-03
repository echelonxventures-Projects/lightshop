import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Button, Price, ProductCard, StoreHeader } from './index';

const meta: Meta = { title: 'LightShop/Overview' };
export default meta;

const Showcase = () => (
  <div>
    <StoreHeader brandName="Any Brand" links={[{ href: '#', label: 'Electronics' }, { href: '#', label: 'Fashion' }]} />
    <div className="ls-container" style={{ padding: 24, display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button>Add to cart</Button>
        <Button variant="secondary">Request quote</Button>
        <Badge>Best seller</Badge>
        <Price formatted="$479.00" size="lg" />
        <Price formatted="₹2,390.00" unit="/ box" />
      </div>
      <div className="ls-grid">
        <ProductCard href="#" title="Nova X2 Smartphone" price="$479.00" meta="3 sellers" badge={<Badge>Deal</Badge>} />
        <ProductCard href="#" title="M8 Hex Bolts (500)" price="₹2,390.00" meta="MOQ 25" />
        <ProductCard href="#" title="Organic Tee" />
      </div>
    </div>
  </div>
);

export const DefaultTheme: StoryObj = { render: () => <Showcase /> };

/** Tenant theming is just CSS variables — same components, different brand. */
export const GreenTenant: StoryObj = {
  render: () => (
    <div style={{ ['--ls-color-primary' as string]: '#0F7B5F', ['--ls-color-accent' as string]: '#C9A227', ['--ls-radius' as string]: '4px' }}>
      <Showcase />
    </div>
  ),
};
