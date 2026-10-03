import { hasBusinessModel } from '@lightshop/tenancy';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listPacks, listProducts } from '../../../lib/catalog';
import { getStore } from '../../../lib/tenant';
import { ProductGrid } from '../../product-grid';

type Props = { params: Promise<{ vertical: string }> };

async function load(vertical: string) {
  const store = await getStore();
  if (!store) notFound();
  const pack = (await listPacks(store)).find((p) => p.id === vertical);
  if (!pack) notFound();
  return { store, pack };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pack } = await load((await params).vertical);
  return { title: pack.name };
}

export default async function CategoryPage({ params }: Props) {
  const { store, pack } = await load((await params).vertical);
  const products = await listProducts(store, pack.id);
  return (
    <>
      <nav className="sf-crumbs"><a href="/">Home</a> / {pack.name}</nav>
      <h1 className="sf-section-title">{pack.name}</h1>
      <p className="sf-muted" style={{ marginBottom: 16 }}>Filter by {pack.facets.join(', ')}</p>
      <ProductGrid products={products} b2b={hasBusinessModel(store.tenant, 'b2b-wholesale')} />
    </>
  );
}
