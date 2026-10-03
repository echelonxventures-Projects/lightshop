import { hasBusinessModel } from '@lightshop/tenancy';
import { Badge, Button, Price } from '@lightshop/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct } from '../../../lib/catalog';
import { displayValue, humanize } from '../../../lib/format';
import { getStore } from '../../../lib/tenant';

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const store = await getStore();
  if (!store) notFound();
  const product = await getProduct(store, id);
  if (!product) notFound();
  return { store, product };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { product } = await load((await params).id);
  return { title: product.title, description: product.description ?? undefined };
}

export default async function ProductPage({ params }: Props) {
  const { store, product } = await load((await params).id);
  const b2b = hasBusinessModel(store.tenant, 'b2b-wholesale');
  const buyBox = product.buyBox;
  const others = product.offers.filter((o) => o.id !== buyBox?.id);
  const unit = b2b && typeof product.attributes.unitOfMeasure === 'string' ? `/ ${product.attributes.unitOfMeasure}` : undefined;

  return (
    <>
      <nav className="sf-crumbs">
        <a href="/">Home</a> / {product.categoryPath.join(' / ')}
      </nav>
      <div className="sf-pdp">
        <div className="ls-card__media" style={{ fontSize: 96 }} aria-hidden="true">{product.title.charAt(0)}</div>
        <div>
          <h1 data-testid="pdp-title">{product.title}</h1>
          {product.description && <p className="sf-muted">{product.description}</p>}

          <section className="sf-buybox" aria-label="Buy box">
            {buyBox ? (
              <>
                <Price formatted={buyBox.price.formatted} unit={unit} size="lg" />
                <p className="sf-muted">
                  Sold by <strong>{buyBox.sellerId}</strong> · {buyBox.stock} in stock
                  {buyBox.condition !== 'NEW' && <> · <Badge>{buyBox.condition.toLowerCase()}</Badge></>}
                </p>
                {b2b && <p className="sf-muted">Minimum order: {buyBox.moq}</p>}
                <Button block>{b2b ? 'Add to quote' : 'Add to cart'}</Button>
                {b2b && store.tenant.features.rfq && <Button variant="secondary" block>Request custom quote</Button>}
              </>
            ) : (
              <p className="sf-muted">Currently unavailable</p>
            )}
          </section>

          {others.length > 0 && (
            <section>
              <h2 className="sf-section-title">Other sellers ({others.length})</h2>
              <ul className="sf-offers">
                {others.map((o) => (
                  <li key={o.id}>
                    <span>{o.sellerId} · {o.condition.toLowerCase()}{b2b && ` · MOQ ${o.moq}`}</span>
                    <Price formatted={o.price.formatted} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <h2 className="sf-section-title" style={{ marginTop: 32 }}>Specifications</h2>
          <table className="ls-table">
            <tbody>
              {Object.entries(product.attributes).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{humanize(k)}</th>
                  <td>{displayValue(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
