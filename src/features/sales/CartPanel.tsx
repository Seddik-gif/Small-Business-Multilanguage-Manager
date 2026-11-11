import { useTranslation } from 'react-i18next';
import { Minus, PauseCircle, PlayCircle, Plus, Scale, ShoppingCart, Tag, Trash2 } from 'lucide-react';
import { useMoney } from '@/hooks/useMoney';
import { formatKg } from '@/lib/money';
import { productName } from '@/lib/product';
import { cartTotal, discountAmount, lineTotal, netTotal, useCart, type CartLine } from '@/stores/cart';

export function CartPanel({
  onCheckout, onEditWeight, onDiscount, onHold, onShowHeld, heldCount,
}: {
  onCheckout: () => void;
  onEditWeight: (line: CartLine) => void;
  onDiscount: () => void;
  onHold: () => void;
  onShowHeld: () => void;
  heldCount: number;
}) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = useMoney();
  const { lines, discount, setQuantity, remove, clear, setDiscount } = useCart();
  const subtotal = cartTotal(lines);
  const off = discountAmount(lines, discount);
  const total = netTotal(lines, discount);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 ps-4 pe-2 py-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShoppingCart className="h-5 w-5" /> {t('sales.cart')}
        </h2>
        {lines.length > 0 && (
          <button type="button" className="btn text-sm text-slate-500 hover:bg-slate-100" onClick={clear}>
            {t('sales.clearCart')}
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
        {lines.length === 0 && <li className="p-6 text-center text-slate-400">{t('sales.emptyCart')}</li>}
        {lines.map((l) => (
          <li key={l.key} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <span dir="auto" className="font-medium leading-snug">{productName(l.product, lng)}</span>
              <span className="shrink-0 font-semibold">{money(lineTotal(l))}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {l.weight_kg !== null ? (
                <button type="button" className="btn-secondary text-sm" onClick={() => onEditWeight(l)}>
                  <Scale className="h-4 w-4" />
                  <span dir="ltr">{formatKg(l.weight_kg, lng)} × {money(l.unit_price)}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button type="button" className="btn-icon bg-slate-100" onClick={() => setQuantity(l.key, l.quantity - 1)} aria-label="−">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-lg font-semibold">{l.quantity}</span>
                  <button type="button" className="btn-icon bg-slate-100" onClick={() => setQuantity(l.key, l.quantity + 1)} aria-label="+">
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="ms-2 text-sm text-slate-500">× {money(l.unit_price)}</span>
                </div>
              )}
              <button type="button" className="btn-icon text-red-600 hover:bg-red-50" onClick={() => remove(l.key)} aria-label={t('common.remove')}>
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-slate-200 p-4">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="btn-secondary px-1 text-sm" disabled={lines.length === 0} onClick={onDiscount}>
            <Tag className="h-4 w-4" /> {t('discount.button')}
          </button>
          <button type="button" className="btn-secondary px-1 text-sm" disabled={lines.length === 0} onClick={onHold}>
            <PauseCircle className="h-4 w-4" /> {t('held.hold')}
          </button>
          <button type="button" className="btn-secondary px-1 text-sm" onClick={onShowHeld} disabled={heldCount === 0}>
            <PlayCircle className="h-4 w-4" /> {t('held.resumeShort')}
            {heldCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{heldCount}</span>}
          </button>
        </div>
        {off > 0 && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-600"><span>{t('receipt.subtotal')}</span><span className="tabular-nums">{money(subtotal)}</span></div>
            <div className="flex items-center justify-between text-emerald-700">
              <span className="flex items-center gap-1">
                {t('receipt.discount')}{discount?.type === 'percent' && <span dir="ltr"> ({discount.value}%)</span>}
                <button type="button" className="btn-icon h-8 min-h-8 w-8 min-w-8 text-slate-400 hover:bg-slate-100" onClick={() => setDiscount(null)} aria-label={t('discount.remove')}>×</button>
              </span>
              <span className="tabular-nums">−{money(off)}</span>
            </div>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-slate-600">{t('common.total')}</span>
          <span className="text-3xl font-bold">{money(total)}</span>
        </div>
        <button type="button" className="btn-primary h-14 w-full text-lg" disabled={lines.length === 0} onClick={onCheckout}>
          {t('sales.charge', { amount: money(total) })}
        </button>
      </div>
    </div>
  );
}
