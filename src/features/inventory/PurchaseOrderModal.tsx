import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { db } from '@/db';
import { Modal } from '@/components/ui/Modal';
import { useMoney } from '@/hooks/useMoney';
import { parseNum } from '@/lib/money';
import { isWeighed, productName } from '@/lib/product';
import type { Product, PurchaseOrder } from '@/types/models';
import { STATUS_STYLE } from './OrdersTab';
import { ReceiveModal } from './ReceiveModal';
import { cancelPurchaseOrder, lineSum, savePurchaseOrder, type OrderLine } from './purchaseOrders';

interface LineState { key: string; itemId?: string; productId: string; qty: string; cost: string }

export interface OrderPrefill { productId: string; qty: number }

/** Loads the order (if any), then shows the editor. */
export function PurchaseOrderModal({ orderId, prefill, onClose }: { orderId: string | null; prefill?: OrderPrefill[]; onClose: () => void }) {
  const loaded = useLiveQuery(async () => {
    if (!orderId) return { order: undefined, items: [] };
    return { order: await db.purchase_orders.get(orderId), items: await db.purchase_order_items.where('purchase_order_id').equals(orderId).filter((i) => !i.deleted).toArray() };
  }, [orderId]);
  const products = useLiveQuery(() => db.products.filter((p) => !p.deleted).toArray(), []);
  if (!loaded || !products) return null;

  const initialLines: LineState[] = orderId
    ? loaded.items.map((i) => ({ key: i.id, itemId: i.id, productId: i.product_id, qty: String(i.quantity), cost: String(i.unit_cost) }))
    : (prefill ?? []).map((l) => ({
        key: l.productId,
        productId: l.productId,
        qty: String(l.qty),
        cost: products.find((p) => p.id === l.productId)?.cost_price?.toString() ?? '',
      }));
  return <Editor order={loaded.order} initialLines={initialLines} products={products} onClose={onClose} />;
}

function Editor({ order, initialLines, products, onClose }: { order?: PurchaseOrder; initialLines: LineState[]; products: Product[]; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = useMoney();
  const suppliers = useLiveQuery(() => db.suppliers.filter((s) => !s.deleted).toArray(), []) ?? [];
  const [supplierId, setSupplierId] = useState(order?.supplier_id ?? '');
  const [lines, setLines] = useState<LineState[]>(initialLines);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState(false);

  const editable = !order || order.status === 'draft';
  const productById = new Map(products.map((p) => [p.id, p]));
  const active = products.filter((p) => p.is_active === 1).sort((a, b) => productName(a, lng).localeCompare(productName(b, lng), lng));

  const parsed = lines.map((l) => ({ l, qty: parseNum(l.qty), cost: parseNum(l.cost) }));
  const total = lineSum(parsed.map(({ qty, cost }) => ({ quantity: qty ?? 0, unitCost: cost ?? 0 })));
  const update = (key: string, patch: Partial<LineState>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async (status: 'draft' | 'ordered') => {
    setError(null);
    if (!supplierId) return setError(t('orders.chooseSupplier'));
    if (lines.length === 0) return setError(t('orders.noLines'));
    if (parsed.some(({ qty, cost }) => qty === null || qty <= 0 || cost === null || cost < 0)) return setError(t('orders.badLine'));
    const out: OrderLine[] = parsed.map(({ l, qty, cost }) => ({ itemId: l.itemId, productId: l.productId, quantity: qty!, unitCost: cost! }));
    setBusy(true);
    try {
      await savePurchaseOrder({ orderId: order?.id, supplierId, status, lines: out });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!order || !window.confirm(t('orders.cancelConfirm'))) return;
    await cancelPurchaseOrder(order.id);
    onClose();
  };

  const title = order ? `${t('orders.title')} #${order.id.slice(0, 8).toUpperCase()}` : t('orders.add');
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {order && order.status !== 'received' && order.status !== 'cancelled' && (
            <button type="button" className="btn-danger" onClick={() => void cancel()}>{t('orders.cancel')}</button>
          )}
          <span className="ms-auto" />
          {editable && (
            <>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => void save('draft')}>{t('orders.saveDraft')}</button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void save('ordered')}>{t('orders.markOrdered')}</button>
            </>
          )}
          {order?.status === 'ordered' && <button type="button" className="btn-primary" onClick={() => setReceiving(true)}>{t('orders.receive')}</button>}
        </div>
      }
    >
      <div className="space-y-4">
        {order && (
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status]}`}>{t(`orders.status.${order.status}`)}</span>
            {order.received_at && <span className="text-sm text-slate-500">{t('orders.receivedOn', { date: new Date(order.received_at).toLocaleDateString(`${lng}-u-nu-latn`) })}</span>}
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <label className="block">
          <span className="label">{t('orders.supplier')}</span>
          <select className="input" disabled={!editable} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{suppliers.length ? t('orders.chooseSupplier') : t('orders.noSuppliers')}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {lines.length === 0 && <li className="p-3 text-sm text-slate-400">{t('orders.noLines')}</li>}
          {lines.map((l) => {
            const p = productById.get(l.productId);
            const sum = lineSum([{ quantity: parseNum(l.qty) ?? 0, unitCost: parseNum(l.cost) ?? 0 }]);
            return (
              <li key={l.key} className="flex flex-wrap items-center gap-2 p-3">
                <div dir="auto" className="min-w-40 flex-1 truncate font-medium">{p ? productName(p, lng) : '?'}</div>
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  {t('orders.qty')}{p && isWeighed(p) ? ' (kg)' : ''}
                  <input className="input w-24 text-end" dir="ltr" inputMode="decimal" disabled={!editable} value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} />
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  {t('orders.cost')}
                  <input className="input w-24 text-end" dir="ltr" inputMode="decimal" disabled={!editable} value={l.cost} onChange={(e) => update(l.key, { cost: e.target.value })} />
                </label>
                <span className="w-20 text-end font-semibold tabular-nums">{money(sum)}</span>
                {editable && (
                  <button type="button" className="btn-icon text-red-600 hover:bg-red-50" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={t('common.remove')}>
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {editable && (
          <select
            className="input"
            aria-label={t('orders.addProduct')}
            value=""
            onChange={(e) => {
              const p = productById.get(e.target.value);
              if (!p || lines.some((l) => l.productId === p.id)) return;
              setLines((ls) => [...ls, { key: p.id, productId: p.id, qty: '', cost: p.cost_price != null ? String(p.cost_price) : '' }]);
            }}
          >
            <option value="">{t('orders.addProduct')}</option>
            {active.filter((p) => !lines.some((l) => l.productId === p.id)).map((p) => <option key={p.id} value={p.id}>{productName(p, lng)}</option>)}
          </select>
        )}

        <div className="flex items-baseline justify-between rounded-xl bg-slate-50 p-3">
          <span className="text-slate-600">{t('common.total')}</span>
          <span className="text-2xl font-bold tabular-nums">{money(order && !editable ? order.total_amount : total)}</span>
        </div>
      </div>
      {receiving && order && <ReceiveModal orderId={order.id} onClose={() => setReceiving(false)} onDone={onClose} />}
    </Modal>
  );
}
