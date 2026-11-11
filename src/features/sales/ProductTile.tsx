import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Scale } from 'lucide-react';
import { useMoney } from '@/hooks/useMoney';
import { useProductImage } from '@/hooks/useProductImage';
import { firstGrapheme, isWeighed, productName } from '@/lib/product';
import { needsReorder } from '@/features/inventory/lowStock';
import type { Category, Product } from '@/types/models';

/** Large photo-first tile: readable for low-literacy users, well above the 44px touch minimum. */
export const ProductTile = memo(function ProductTile({
  product, category, onPick,
}: { product: Product; category?: Category; onPick: (p: Product) => void }) {
  const { i18n } = useTranslation();
  const money = useMoney();
  const img = useProductImage(product.id);
  const name = productName(product, i18n.resolvedLanguage ?? 'it');
  const weighed = isWeighed(product);
  const color = category?.color ?? '#64748b';

  return (
    <button
      type="button"
      onClick={() => onPick(product)}
      className="flex flex-col overflow-hidden rounded-xl bg-white text-start shadow-sm ring-1 ring-slate-200 transition hover:ring-emerald-400 active:scale-[0.97]"
    >
      <div className="relative aspect-[4/3] w-full" style={{ backgroundColor: `${color}22` }}>
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="flex h-full items-center justify-center text-4xl font-bold" style={{ color }}>
            {firstGrapheme(name)}
          </span>
        )}
        {weighed && (
          <span className="absolute start-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs text-white">
            <Scale className="h-3 w-3" /> kg
          </span>
        )}
        {product.stock_quantity <= 0 ? (
          <span className="absolute end-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">0</span>
        ) : (
          needsReorder(product) && (
            <span dir="ltr" className="absolute end-1.5 top-1.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">
              {product.stock_quantity}{weighed ? ' kg' : ''}
            </span>
          )
        )}
        <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: color }} />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-1 p-2">
        <span dir="auto" className="line-clamp-2 text-sm font-medium leading-snug">{name}</span>
        <span className="font-bold text-emerald-700">
          {money(weighed ? product.price_per_kg! : product.price)}
          {weighed && <span className="text-xs font-normal text-slate-500">/kg</span>}
        </span>
      </div>
    </button>
  );
});
