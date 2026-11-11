import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/db';
import { useMoney } from '@/hooks/useMoney';
import type { PurchaseOrderStatus } from '@/types/models';

export const STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  ordered: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-50 text-red-700',
};

export function OrdersTab({ onOpen }: { onOpen: (orderId: string | null) => void }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const orders = useLiveQuery(() => db.purchase_orders.filter((o) => !o.deleted).toArray(), []);
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []);
  const names = useMemo(() => new Map((suppliers ?? []).map((s) => [s.id, s.deleted ? `${s.name} ${t('orders.supplierDeleted')}` : s.name])), [suppliers, t]);
  const lng = i18n.resolvedLanguage ?? 'it';
  const sorted = [...(orders ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return (
    <div className="space-y-4">
      <button type="button" className="btn-primary" onClick={() => onOpen(null)}>
        <Plus className="h-5 w-5" /> {t('orders.add')}
      </button>
      {orders?.length === 0 && <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">{t('orders.empty')}</div>}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {sorted.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => onOpen(o.id)} className="flex min-h-14 w-full items-center gap-3 p-3 text-start hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div dir="auto" className="truncate font-medium">{names.get(o.supplier_id) ?? '?'}</div>
                <div className="text-xs text-slate-500">
                  #{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString(`${lng}-u-nu-latn`)}
                </div>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>{t(`orders.status.${o.status}`)}</span>
              <span className="w-24 text-end font-semibold tabular-nums">{money(o.total_amount)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
