import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ImagePlus, ScanBarcode, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { saveRecord, softDelete, stamp } from '@/db/repo';
import { Modal } from '@/components/ui/Modal';
import { BarcodeScannerModal, cameraScanSupported } from '@/components/BarcodeScannerModal';
import { useProductImage } from '@/hooks/useProductImage';
import { nowIso } from '@/lib/id';
import { resizeImage } from '@/lib/image';
import { parseNum, round3 } from '@/lib/money';
import { NAME_LANGS, isWeighed, type NameLang } from '@/lib/product';
import { LANGUAGES } from '@/i18n';
import type { Category, IvaRate, Product, StockMovement } from '@/types/models';

const IVA_RATES: IvaRate[] = [4, 10, 22];
const str = (n: number | null | undefined) => (n == null ? '' : String(n));

export function ProductForm({ product, categories, onClose }: { product: Product | null; categories: Category[]; onClose: () => void }) {
  const { t } = useTranslation();
  const existingImage = useProductImage(product?.id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [names, setNames] = useState<Record<NameLang, string>>(() =>
    Object.fromEntries(NAME_LANGS.map((l) => [l, product?.[`name_${l}`] ?? ''])) as Record<NameLang, string>,
  );
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [byWeight, setByWeight] = useState(product ? isWeighed(product) : false);
  const [price, setPrice] = useState(str(product?.price));
  const [pricePerKg, setPricePerKg] = useState(str(product?.price_per_kg));
  const [costPrice, setCostPrice] = useState(str(product?.cost_price));
  const [stock, setStock] = useState(str(product?.stock_quantity ?? 0));
  const [minStock, setMinStock] = useState(str(product?.min_stock));
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [iva, setIva] = useState<IvaRate>(product?.iva_rate ?? 22);
  const [active, setActive] = useState(product ? product.is_active === 1 : true);
  const [image, setImage] = useState<{ blob: Blob | null; url: string | null } | null>(null); // null = unchanged
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (image?.url) URL.revokeObjectURL(image.url); }, [image]);
  const preview = image ? image.url : existingImage;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const blob = await resizeImage(file);
    setImage({ blob, url: URL.createObjectURL(blob) });
  };

  const save = async () => {
    setError(null);
    const trimmed = Object.fromEntries(NAME_LANGS.map((l) => [l, names[l].trim()])) as Record<NameLang, string>;
    // name_it is NOT NULL and the universal fallback: use the first name given if Italian is empty.
    const fallback = trimmed.it || NAME_LANGS.map((l) => trimmed[l]).find(Boolean);
    if (!fallback) return setError(t('products.nameRequired'));

    const unitPrice = parseNum(price);
    const kgPrice = parseNum(pricePerKg);
    if (byWeight ? !kgPrice || kgPrice <= 0 : unitPrice === null || unitPrice < 0) return setError(t('products.priceRequired'));

    const code = barcode.trim() || null;
    if (code) {
      const dup = await db.products.where('barcode').equals(code).filter((p) => !p.deleted && p.id !== product?.id).count();
      if (dup) return setError(t('products.duplicateBarcode'));
    }

    const newStock = round3(parseNum(stock) ?? 0);
    setBusy(true);
    try {
      await db.transaction('rw', [db.products, db.stock_movements, db.product_images, db.outbox], async () => {
        const row = stamp<Product>(
          {
            barcode: code,
            // Removing the photo clears the link so other tills drop it too. A NEW photo keeps the old
            // link until sync uploads it (sync/photos.ts then points image_url at the new file).
            image_url: image && image.blob === null ? null : product?.image_url ?? null,
            name_it: fallback,
            name_en: trimmed.en || null,
            name_ar: trimmed.ar || null,
            name_bn: trimmed.bn || null,
            name_zh: trimmed.zh || null,
            price: byWeight ? 0 : unitPrice!,
            price_per_kg: byWeight ? kgPrice : null,
            cost_price: parseNum(costPrice),
            stock_quantity: newStock,
            min_stock: parseNum(minStock),
            category_id: categoryId || null,
            iva_rate: iva,
            is_active: active ? 1 : 0,
          },
          product ?? undefined,
        );
        await saveRecord('products', row);
        // Stock changes always go through the ledger, never as a bare number.
        const delta = round3(newStock - (product?.stock_quantity ?? 0));
        if (delta !== 0) {
          await saveRecord('stock_movements', stamp<StockMovement>({ product_id: row.id, delta, reason: 'adjustment', ref_id: null }));
        }
        if (image) {
          if (image.blob) await db.product_images.put({ id: row.id, blob: image.blob, updated_at: nowIso(), sync_status: 'pending' });
          else await db.product_images.delete(row.id);
        }
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!product || !window.confirm(t('products.deleteConfirm'))) return;
    await softDelete('products', product.id);
    onClose();
  };

  return (
    <Modal
      title={product ? t('products.edit') : t('products.add')}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-2">
          {product && (
            <button type="button" className="btn-danger" onClick={remove}>
              <Trash2 className="h-5 w-5" /> {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn-secondary ms-auto" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>{t('common.save')}</button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {/* Photo */}
        <div className="flex items-center gap-3">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-8 w-8 text-slate-400" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <Camera className="h-5 w-5" /> {t('products.takePhoto')}
            </button>
            {preview && (
              <button type="button" className="btn text-red-600 hover:bg-red-50" onClick={() => setImage({ blob: null, url: null })}>
                {t('products.removePhoto')}
              </button>
            )}
          </div>
          {/* capture opens the rear camera on phones/tablets; on desktop it's a file picker */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>

        {/* Names */}
        <fieldset>
          <legend className="label">{t('products.names')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {LANGUAGES.map((l) => (
              <label key={l.code} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm text-slate-500">{l.label}</span>
                <input
                  className="input"
                  dir={l.dir}
                  lang={l.code}
                  value={names[l.code]}
                  onChange={(e) => setNames((n) => ({ ...n, [l.code]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </fieldset>

        {/* Barcode */}
        <div>
          <label className="label" htmlFor="pf-barcode">{t('products.barcode')}</label>
          <div className="flex gap-2">
            <input id="pf-barcode" className="input" dir="ltr" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            {cameraScanSupported && (
              <button type="button" className="btn-secondary" onClick={() => setScanning(true)} aria-label={t('sales.scanCamera')}>
                <ScanBarcode className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div>
          <span className="label">{t('products.soldBy')}</span>
          <div className="grid grid-cols-2 gap-2">
            {[false, true].map((w) => (
              <button
                key={String(w)}
                type="button"
                className={`btn ${byWeight === w ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}
                onClick={() => setByWeight(w)}
              >
                {w ? t('products.byWeight') : t('products.byUnit')}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField label={byWeight ? t('products.pricePerKg') : t('products.price')} value={byWeight ? pricePerKg : price} onChange={byWeight ? setPricePerKg : setPrice} />
          <NumField label={t('products.costPrice')} value={costPrice} onChange={setCostPrice} />
          <NumField label={`${t('products.stock')}${byWeight ? ' (kg)' : ''}`} value={stock} onChange={setStock} />
          <NumField label={`${t('inventory.min')}${byWeight ? ' (kg)' : ''}`} value={minStock} onChange={setMinStock} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pf-cat">{t('products.category')}</label>
            <select id="pf-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('products.noCategory')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <span className="label">{t('products.vat')}</span>
            <div className="grid grid-cols-3 gap-2">
              {IVA_RATES.map((r) => (
                <button key={r} type="button" className={`btn ${iva === r ? 'bg-slate-800 text-white' : 'bg-slate-100'}`} onClick={() => setIva(r)}>
                  {r}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-emerald-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t('products.active')}
        </label>
      </div>

      {scanning && (
        <BarcodeScannerModal onClose={() => setScanning(false)} onDetected={(c) => { setBarcode(c); setScanning(false); }} />
      )}
    </Modal>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input" dir="ltr" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
