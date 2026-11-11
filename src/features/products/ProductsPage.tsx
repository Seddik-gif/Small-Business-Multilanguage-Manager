import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ImageIcon, Plus, Search, Tags } from 'lucide-react';
import { db } from '@/db';
import { useMoney } from '@/hooks/useMoney';
import { useProductImage } from '@/hooks/useProductImage';
import { isWeighed, matchesQuery, productName } from '@/lib/product';
import type { Category, Product } from '@/types/models';
import { CategoryManager } from './CategoryManager';
import { ProductForm } from './ProductForm';
import { seedDemo } from './demoData';

export function ProductsPage() {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const products = useLiveQuery(() => db.products.filter((p) => !p.deleted).toArray(), []);
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []) ?? [];
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [managingCats, setManagingCats] = useState(false);

  const visible = useMemo(
    () => (products ?? []).filter((p) => matchesQuery(p, query)).sort((a, b) => productName(a, lng).localeCompare(productName(b, lng), lng)),
    [products, query, lng],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="me-auto text-2xl font-bold">{t('nav.products')}</h1>
        <button type="button" className="btn-secondary" onClick={() => setManagingCats(true)}>
          <Tags className="h-5 w-5" /> {t('products.categories')}
        </button>
        <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
          <Plus className="h-5 w-5" /> {t('products.add')}
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input className="input ps-10" dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} />
      </div>

      {products?.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">
          <p className="mb-3">{t('products.empty')}</p>
          <button type="button" className="btn-secondary" onClick={() => void seedDemo()}>{t('products.loadDemo')}</button>
        </div>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} category={p.category_id ? catById.get(p.category_id) : undefined} onEdit={() => setEditing(p)} />
        ))}
      </ul>

      {editing && <ProductForm product={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} />}
      {managingCats && <CategoryManager categories={categories} onClose={() => setManagingCats(false)} />}
    </section>
  );
}

function ProductRow({ product, category, onEdit }: { product: Product; category?: Category; onEdit: () => void }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const img = useProductImage(product.id);
  const weighed = isWeighed(product);
  return (
    <li>
      <button type="button" onClick={onEdit} className={`flex w-full items-center gap-3 p-3 text-start hover:bg-slate-50 ${product.is_active ? '' : 'opacity-50'}`}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
          {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-slate-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <div dir="auto" className="truncate font-medium">{productName(product, i18n.resolvedLanguage ?? 'it')}</div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {category && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />}
            {category?.name}
            {product.barcode && <span dir="ltr" className="font-mono text-xs">{product.barcode}</span>}
          </div>
        </div>
        <div className="text-end">
          <div className="font-semibold">{money(weighed ? product.price_per_kg! : product.price)}{weighed && '/kg'}</div>
          <div className={`text-sm ${product.stock_quantity <= 0 ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
            {t('products.stock')}: <span dir="ltr">{product.stock_quantity}{weighed ? ' kg' : ''}</span>
          </div>
        </div>
      </button>
    </li>
  );
}
