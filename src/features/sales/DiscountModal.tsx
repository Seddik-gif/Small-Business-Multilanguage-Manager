import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keypad, applyKey } from '@/components/ui/Keypad';
import { Modal } from '@/components/ui/Modal';
import { useMoney } from '@/hooks/useMoney';
import { round2 } from '@/lib/money';
import { cartTotal, discountAmount, type CartLine, type Discount } from '@/stores/cart';

const PERCENT_PRESETS = [5, 10, 15, 20];

/** Percentage or fixed-amount discount on the whole basket. */
export function DiscountModal({
  lines, current, onApply, onClose,
}: { lines: CartLine[]; current: Discount | null; onApply: (d: Discount | null) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const [type, setType] = useState<Discount['type']>(current?.type ?? 'percent');
  const [value, setValue] = useState(current ? String(current.value) : '');
  const subtotal = cartTotal(lines);
  const num = Number(value) || 0;
  const tooMuch = type === 'percent' ? num > 100 : num > subtotal;
  const preview = tooMuch ? 0 : discountAmount(lines, { type, value: num });

  return (
    <Modal
      title={t('discount.title')}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex gap-2">
          {current && (
            <button type="button" className="btn-danger" onClick={() => { onApply(null); onClose(); }}>{t('discount.remove')}</button>
          )}
          <button
            type="button"
            className="btn-primary h-14 flex-1 text-lg"
            disabled={!(num > 0) || tooMuch}
            onClick={() => { onApply({ type, value: round2(num) }); onClose(); }}
          >
            {t('discount.apply')}
          </button>
        </div>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(['percent', 'fixed'] as const).map((tp) => (
          <button key={tp} type="button" aria-pressed={type === tp} className={`btn ${type === tp ? 'bg-slate-800 text-white' : 'bg-slate-100'}`} onClick={() => { setType(tp); setValue(''); }}>
            {tp === 'percent' ? '%' : '€'}
          </button>
        ))}
      </div>
      <div className="mb-3 rounded-xl bg-slate-50 p-3 text-center">
        <div dir="ltr" className="text-4xl font-bold tabular-nums">{value || '0'}<span className="text-2xl text-slate-500"> {type === 'percent' ? '%' : '€'}</span></div>
        {tooMuch ? (
          <div className="mt-1 text-sm text-red-600">{type === 'percent' ? t('discount.maxPercent') : t('discount.exceeds', { amount: money(subtotal) })}</div>
        ) : (
          <div className="mt-1 text-sm text-slate-500">
            {t('discount.saves')}: <span className="font-semibold text-emerald-700">{money(preview)}</span> · {t('common.total')}: <span className="font-semibold">{money(round2(subtotal - preview))}</span>
          </div>
        )}
      </div>
      {type === 'percent' && (
        <div dir="ltr" className="mb-3 grid grid-cols-4 gap-2">
          {PERCENT_PRESETS.map((p) => (
            <button key={p} type="button" className="btn-secondary px-1" onClick={() => setValue(String(p))}>{p}%</button>
          ))}
        </div>
      )}
      <Keypad onKey={(k) => setValue((v) => applyKey(v, k, 2))} />
    </Modal>
  );
}
