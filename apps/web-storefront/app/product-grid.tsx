import { Badge, ProductCard } from '@lightshop/ui';
import type { ProductSummary } from '../lib/catalog';

export function ProductGrid({ products, b2b }: { products: ProductSummary[]; b2b: boolean }) {
  if (products.length === 0) return <p className="sf-empty">No products yet.</p>;
  return (
    <div className="ls-grid">
      {products.map((p) => {
        const sellers = p.offers.length;
        const meta = b2b && p.buyBox ? `MOQ ${p.buyBox.moq}` : sellers > 1 ? `${sellers} sellers` : undefined;
        return (
          <ProductCard
            key={p.id}
            href={`/p/${p.id}`}
            title={p.title}
            price={p.buyBox?.price.formatted}
            meta={meta}
            badge={sellers > 1 ? <Badge>Compare offers</Badge> : undefined}
          />
        );
      })}
    </div>
  );
}
