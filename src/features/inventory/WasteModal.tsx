import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Modal } from '@/components/ui/Modal';
import { useMoney } from '@/hooks/useMoney';
import { parseNum, round2 } from '@/lib/money';
import { isWeighed, productName } from '@/lib/product';
import type { WasteReason } from '@/types/models';
import { WASTE_REASONS, createWaste } from './waste';

/** Record unsold or lost stock: which product, how much, why. */
export function WasteModal({ productId, onClose }: { productId?: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = useMoney();
  const products = useLiveQuery(() => db.products.filter((p) => !p.deleted && p.is_active === 1).toArray(), []);
  const [pid, setPid] = useState(productId ?? '');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<WasteReason>('expired');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const product = products?.find((p) => p.id === pid);
  const amount = parseNum(qty) ?? 0;
  const estimate = product?.cost_price != null ? round2(amount * product.cost_price) : null;
  const overStock = !!product && amount > product.stock_quantity;

  const save = async () => {
    setError(null);
    if (!product) return setError(t('waste.chooseProduct'));
    if (!(amount > 0)) return setError(t('waste.badQty'));
    setBusy(true);
    try {
      await createWaste({ productId: product.id, quantity: amount, reason, note });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('waste.add')}
      onClose={onClose}
      size="sm"
      footer={<button type="button" className="btn-primary h-12 w-full" disabled={busy} onClick={() => void save()}>{t('common.save')}</button>}
    >
      <div className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block">
          <span className="label">{t('waste.product')}</span>
          <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">{t('waste.chooseProduct')}</option>
            {[...(products ?? [])].sort((a, b) => productName(a, lng).localeCompare(productName(b, lng), lng)).map((p) => (
              <option key={p.id} value={p.id}>{productName(p, lng)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t('waste.qty')}{product && isWeighed(product) ? ' (kg)' : ''}</span>
          <input className="input text-xl" dir="ltr" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        {overStock && <p className="text-sm text-amber-700">{t('waste.exceedsStock', { stock: product!.stock_quantity })}</p>}
        <div>
          <span className="label">{t('waste.reason')}</span>
          <div className="flex flex-wrap gap-2">
            {WASTE_REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} className={`btn ${reason === r ? 'bg-slate-800 text-white' : 'bg-slate-100'}`} onClick={() => setReason(r)}>
                {t(`waste.reasons.${r}`)}
              </button>
            ))}
          </div>
        </div>
        <input className="input" dir="auto" placeholder={t('debt.paymentNote')} value={note} onChange={(e) => setNote(e.target.value)} />
        {estimate !== null && amount > 0 && <p className="text-sm text-slate-500">{t('waste.estimate')}: {money(estimate)}</p>}
      </div>
    </Modal>
  );
}
