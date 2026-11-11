import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { Modal } from '@/components/ui/Modal';
import { parseNum } from '@/lib/money';
import { isWeighed, productName } from '@/lib/product';
import type { PurchaseOrderItem } from '@/types/models';
import { receivePurchaseOrder } from './purchaseOrders';

/** Confirm what actually arrived. Reduce a quantity if the delivery was short; 0 drops the line. */
export function ReceiveModal({ orderId, onClose, onDone }: { orderId: string; onClose: () => void; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const items = useLiveQuery(() => db.purchase_order_items.where('purchase_order_id').equals(orderId).filter((i) => !i.deleted).toArray(), [orderId]);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [updateCost, setUpdateCost] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!items || !products) return null;

  const productOf = (i: PurchaseOrderItem) => products.find((p) => p.id === i.product_id);
  const valueOf = (i: PurchaseOrderItem) => qty[i.id] ?? String(i.quantity);

  const confirm = async () => {
    setError(null);
    const received: Record<string, number> = {};
    for (const i of items) {
      const n = parseNum(valueOf(i));
      if (n === null || n < 0) return setError(t('orders.badQty'));
      received[i.id] = n;
    }
    if (Object.values(received).every((n) => n === 0)) return setError(t('orders.nothingReceived'));
    setBusy(true);
    try {
      await receivePurchaseOrder(orderId, received, updateCost);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('orders.receive')}
      onClose={onClose}
      footer={<button type="button" className="btn-primary h-12 w-full" disabled={busy} onClick={() => void confirm()}>{t('orders.confirmReceive')}</button>}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">{t('orders.receiveHint')}</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {items.map((i) => {
            const p = productOf(i);
            return (
              <li key={i.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div dir="auto" className="truncate font-medium">{p ? productName(p, lng) : '?'}</div>
                  <div className="text-xs text-slate-500">{t('orders.ordered')}: <span dir="ltr">{i.quantity}{p && isWeighed(p) ? ' kg' : ''}</span></div>
                </div>
                <input
                  className="input w-28 text-end"
                  dir="ltr"
                  inputMode="decimal"
                  aria-label={t('orders.receivedQty')}
                  value={valueOf(i)}
                  onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                />
              </li>
            );
          })}
        </ul>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-emerald-600" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} />
          {t('orders.updateCost')}
        </label>
      </div>
    </Modal>
  );
}
