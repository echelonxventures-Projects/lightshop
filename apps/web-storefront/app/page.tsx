import { hasBusinessModel } from '@lightshop/tenancy';
import { notFound } from 'next/navigation';
import { listProducts } from '../lib/catalog';
import { getStore } from '../lib/tenant';
import { ProductGrid } from './product-grid';

export default async function Home() {
  const store = await getStore();
  if (!store) notFound();
  const { tenant } = store;
  const products = await listProducts(store);
  return (
    <>
      <section className="sf-hero">
        <h1>{tenant.brand.name}</h1>
        {tenant.brand.tagline && <p>{tenant.brand.tagline}</p>}
      </section>
      <h2 className="sf-section-title">Featured</h2>
      <ProductGrid products={products} b2b={hasBusinessModel(tenant, 'b2b-wholesale')} />
    </>
  );
}
