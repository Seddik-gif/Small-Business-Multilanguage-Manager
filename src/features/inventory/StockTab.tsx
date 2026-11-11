import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardList, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { saveRecord, stamp } from '@/db/repo';
import { Modal } from '@/components/ui/Modal';
import { parseNum } from '@/lib/money';
import { isWeighed, matchesQuery, productName } from '@/lib/product';
import type { Product } from '@/types/models';
import { needsReorder } from './lowStock';

/** Stock levels, with the products that need reordering first. */
export function StockTab({ onOrder, onWaste }: { onOrder: (prefill: { productId: string; qty: number }[]) => void; onWaste: (productId: string) => void }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const products = useLiveQuery(() => db.products.filter((p) => !p.deleted && p.is_active === 1).toArray(), []);
  const [query, setQuery] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [minFor, setMinFor] = useState<Product | null>(null);

  const rows = useMemo(
    () =>
      (products ?? [])
        .filter((p) => matchesQuery(p, query) && (!onlyLow || needsReorder(p)))
        .sort((a, b) => Number(needsReorder(b)) - Number(needsReorder(a)) || productName(a, lng).localeCompare(productName(b, lng), lng)),
    [products, query, onlyLow, lng],
  );
  const lowProducts = (products ?? []).filter(needsReorder);

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-3 rounded-xl p-4 ${lowProducts.length ? 'bg-amber-50' : 'bg-white shadow-sm'}`}>
        <div className="min-w-0 flex-1">
          <div className={`text-lg font-semibold ${lowProducts.length ? 'text-amber-900' : 'text-emerald-700'}`}>
            {lowProducts.length ? t('inventory.lowCount', { count: lowProducts.length }) : t('inventory.noneLow')}
          </div>
        </div>
        {lowProducts.length > 0 && (
          <button
            type="button"
            className="btn-primary"
            // Order one "minimum batch" of each low product; every quantity stays editable in the order.
            onClick={() => onOrder(lowProducts.map((p) => ({ productId: p.id, qty: p.min_stock || 1 })))}
          >
            <ClipboardList className="h-5 w-5" /> {t('inventory.orderLow')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className="input ps-10" dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('inventory.search')} />
        </div>
        {[false, true].map((v) => (
          <button key={String(v)} type="button" className={`btn ${onlyLow === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`} onClick={() => setOnlyLow(v)}>
            {v ? t('inventory.low') : t('inventory.all')}
          </button>
        ))}
      </div>

      {products?.length === 0 && <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">{t('inventory.empty')}</div>}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {rows.map((p) => {
          const low = needsReorder(p);
          const unit = isWeighed(p) ? ' kg' : '';
          return (
            <li key={p.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div dir="auto" className="truncate font-medium">{productName(p, lng)}</div>
                <div className="text-xs text-slate-500">{p.min_stock != null ? t('inventory.minShort', { value: `${p.min_stock}${unit}` }) : t('inventory.noMin')}</div>
              </div>
              <div dir="ltr" className={`text-lg font-semibold tabular-nums ${p.stock_quantity <= 0 ? 'text-red-600' : low ? 'text-amber-600' : 'text-slate-800'}`}>
                {p.stock_quantity}{unit}
              </div>
              <button type="button" className="btn-icon text-slate-500 hover:bg-slate-100" onClick={() => setMinFor(p)} aria-label={t('inventory.min')} title={t('inventory.min')}>
                <SlidersHorizontal className="h-5 w-5" />
              </button>
              <button type="button" className="btn-icon text-slate-500 hover:bg-slate-100" onClick={() => onWaste(p.id)} aria-label={t('waste.add')} title={t('waste.add')}>
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          );
        })}
      </ul>
      {minFor && <MinStockModal product={minFor} onClose={() => setMinFor(null)} />}
    </div>
  );
}

function MinStockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState(product.min_stock != null ? String(product.min_stock) : '');
  const parsed = parseNum(value);
  const invalid = value.trim() !== '' && (parsed === null || parsed < 0);

  const save = async () => {
    if (invalid) return;
    await saveRecord('products', stamp<Product>({ ...product, min_stock: parsed }, product));
    onClose();
  };

  return (
    <Modal
      title={`${t('inventory.min')} · ${productName(product, i18n.resolvedLanguage ?? 'it')}`}
      onClose={onClose}
      size="sm"
      footer={<button type="button" className="btn-primary h-12 w-full" disabled={invalid} onClick={() => void save()}>{t('common.save')}</button>}
    >
      <label className="block">
        <input className="input text-xl" dir="ltr" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="—" />
        <span className="mt-2 block text-sm text-slate-500">{t('inventory.minHint')}</span>
      </label>
    </Modal>
  );
}
