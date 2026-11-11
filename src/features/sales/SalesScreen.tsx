import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Camera, ScanBarcode, ShoppingCart, X } from 'lucide-react';
import { db } from '@/db';
import { BarcodeScannerModal, cameraScanSupported } from '@/components/BarcodeScannerModal';
import { useMoney } from '@/hooks/useMoney';
import { useScannerWedge } from '@/hooks/useScannerWedge';
import { isWeighed, matchesQuery, productName } from '@/lib/product';
import { discountAmount, netTotal, useCart, type CartLine } from '@/stores/cart';
import { useSession } from '@/stores/session';
import type { Product } from '@/types/models';
import { ReceiptModal } from '@/features/receipt/ReceiptModal';
import { CartPanel } from './CartPanel';
import { CheckoutModal, type CheckoutResult } from './CheckoutModal';
import { DiscountModal } from './DiscountModal';
import { HeldModal } from './HeldModal';
import { discardHeld, holdCart, loadHeld } from './held';
import { ProductTile } from './ProductTile';
import { WeightModal } from './WeightModal';
import { createSale } from './createSale';

type Weighing = { product: Product; lineKey?: string; initialKg?: number };

export function SalesScreen() {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = useMoney();

  const products = useLiveQuery(() => db.products.filter((p) => !p.deleted && p.is_active === 1).toArray(), []);
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []) ?? [];
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const { lines, discount, add, setQuantity, clear, setDiscount, restore } = useCart();
  const total = netTotal(lines, discount); // what the customer pays, after any discount
  const heldCount = useLiveQuery(() => db.held_sales.count(), []) ?? 0;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [weighing, setWeighing] = useState<Weighing | null>(null);
  const [scanning, setScanning] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; tendered: number | null } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [discounting, setDiscounting] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const modalOpen = !!weighing || scanning || checkingOut || !!receipt || discounting || showHeld;

  const pick = useCallback(
    (p: Product) => {
      setMessage(null);
      if (isWeighed(p)) setWeighing({ product: p });
      else add(p);
    },
    [add],
  );

  /** Barcode from search field, USB scanner or camera: exact match adds to cart. */
  const handleCode = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const hit = products?.find((p) => p.barcode === code);
      if (hit) {
        pick(hit);
        setQuery('');
      } else {
        setMessage(t('sales.notFound', { code }));
      }
    },
    [products, pick, t],
  );
  useScannerWedge(handleCode, !modalOpen);

  const visible = useMemo(
    () =>
      (products ?? [])
        .filter((p) => (!category || p.category_id === category) && matchesQuery(p, query))
        .sort((a, b) => productName(a, lng).localeCompare(productName(b, lng), lng)),
    [products, category, query, lng],
  );

  const onSearchEnter = () => {
    const q = query.trim();
    if (!q) return;
    if (products?.some((p) => p.barcode === q)) handleCode(q);
    else if (visible.length === 1) {
      pick(visible[0]);
      setQuery('');
    } else if (/^\d{6,}$/.test(q)) setMessage(t('sales.notFound', { code: q }));
  };

  const completeSale = async ({ method, tendered, customer, deposit }: CheckoutResult) => {
    const id = await createSale(lines, method, {
      staff_id: useSession.getState().staff?.id ?? null,
      customer_id: customer?.id ?? null,
      discount_amount: discountAmount(lines, discount),
      deposit,
    });
    clear(); // also drops the discount: the next customer must not inherit it
    setCheckingOut(false);
    setCartOpen(false);
    setReceipt({ id, tendered });
  };

  const editWeight = (l: CartLine) => setWeighing({ product: l.product, lineKey: l.key, initialKg: l.weight_kg ?? undefined });

  /** Park the basket and start with an empty one. */
  const hold = async () => {
    if (lines.length === 0) return;
    await holdCart(lines, discount, lng);
    clear();
    setCartOpen(false);
  };

  /** Bring a parked sale back. A basket already being rung up is parked first, so nothing is lost. */
  const resume = async (id: string) => {
    const resumed = await loadHeld(id);
    if (lines.length > 0) await holdCart(lines, discount, lng);
    restore(resumed.lines, resumed.discount);
    await discardHeld(id);
    setShowHeld(false);
    const notes = [
      resumed.repriced ? t('held.repriced', { count: resumed.repriced }) : '',
      resumed.dropped ? t('held.dropped', { count: resumed.dropped }) : '',
    ].filter(Boolean);
    setMessage(notes.length ? notes.join(' ') : null);
  };

  const cart = (
    <CartPanel
      onCheckout={() => setCheckingOut(true)}
      onEditWeight={editWeight}
      onDiscount={() => setDiscounting(true)}
      onHold={() => void hold()}
      onShowHeld={() => setShowHeld(true)}
      heldCount={heldCount}
    />
  );

  return (
    <div className="-m-4 flex h-[calc(100%+2rem)] min-h-0 flex-col lg:flex-row">
      {/* Catalogue */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              className="input ps-10"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setMessage(null); }}
              onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
              placeholder={t('sales.searchPlaceholder')}
              autoComplete="off"
              enterKeyHint="search"
              dir="auto"
            />
            {query && (
              <button type="button" className="btn-icon absolute end-0 top-0 text-slate-400" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label={t('common.clear')}>
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {cameraScanSupported && (
            <button type="button" className="btn-secondary" onClick={() => setScanning(true)} aria-label={t('sales.scanCamera')}>
              <Camera className="h-5 w-5" />
            </button>
          )}
        </div>
        {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

        {categories.length > 0 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <CategoryChip active={!category} onClick={() => setCategory(null)} label={t('sales.allCategories')} />
            {categories.map((c) => (
              <CategoryChip key={c.id} active={category === c.id} color={c.color} onClick={() => setCategory(c.id)} label={c.name} />
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {products && products.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">
              <p className="mb-3">{t('sales.noProducts')}</p>
              <Link to="/products" className="btn-primary">{t('nav.products')}</Link>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 pb-2">
              {visible.map((p) => (
                <ProductTile key={p.id} product={p} category={p.category_id ? catById.get(p.category_id) : undefined} onPick={pick} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart: side panel on large screens, bottom bar + sheet on phones/small tablets */}
      <aside className="hidden w-96 shrink-0 border-s border-slate-200 lg:block">{cart}</aside>
      <button
        type="button"
        className="btn m-2 h-14 justify-between bg-emerald-600 text-lg text-white lg:hidden"
        onClick={() => setCartOpen(true)}
      >
        <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> {t('sales.cart')} ({lines.length})</span>
        <span className="font-bold">{money(total)}</span>
      </button>
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/40 lg:hidden" onClick={() => setCartOpen(false)}>
          <div className="mt-auto flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            {cart}
          </div>
        </div>
      )}

      {weighing && (
        <WeightModal
          product={weighing.product}
          initialKg={weighing.initialKg}
          onClose={() => setWeighing(null)}
          onConfirm={(kg) => {
            if (weighing.lineKey) setQuantity(weighing.lineKey, kg);
            else add(weighing.product, kg);
            setWeighing(null);
          }}
        />
      )}
      {scanning && (
        <BarcodeScannerModal
          onClose={() => setScanning(false)}
          onDetected={(code) => { setScanning(false); handleCode(code); }}
        />
      )}
      {discounting && <DiscountModal lines={lines} current={discount} onApply={setDiscount} onClose={() => setDiscounting(false)} />}
      {showHeld && <HeldModal onResume={(id) => void resume(id)} onClose={() => setShowHeld(false)} />}
      {checkingOut && <CheckoutModal total={total} onClose={() => setCheckingOut(false)} onComplete={completeSale} />}
      {receipt && <ReceiptModal saleId={receipt.id} tendered={receipt.tendered} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function CategoryChip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn shrink-0 whitespace-nowrap border text-sm ${active ? 'border-transparent bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
    >
      {color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}
