import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/db';
import { useMoney } from '@/hooks/useMoney';
import { round2 } from '@/lib/money';
import { isWeighed, productName } from '@/lib/product';
import type { Product, StockMovement } from '@/types/models';

const DAY = 86_400_000;

export function WasteTab({ onAdd }: { onAdd: () => void }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = useMoney();
  const data = useLiveQuery(async () => {
    const moves = await db.stock_movements.where('reason').equals('waste').filter((m) => !m.deleted).toArray();
    const products = await db.products.bulkGet([...new Set(moves.map((m) => m.product_id))]);
    return { moves, products: new Map(products.filter((p): p is Product => !!p).map((p) => [p.id, p])) };
  }, []);

  const moves = [...(data?.moves ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 200);
  const valueOf = (m: StockMovement) => {
    const cost = data?.products.get(m.product_id)?.cost_price;
    return cost == null ? null : round2(Math.abs(m.delta) * cost);
  };
  const recent = moves.filter((m) => Date.now() - Date.parse(m.created_at) <= 30 * DAY);
  const lost = round2(recent.reduce((s, m) => s + (valueOf(m) ?? 0), 0));
  const noCost = recent.filter((m) => valueOf(m) === null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-500">{t('waste.loss30')}</div>
          <div className="text-3xl font-bold tabular-nums text-red-600">{money(lost)}</div>
          <div className="text-xs text-slate-500">
            {t('waste.estimateNote')}{noCost > 0 ? ` · ${t('waste.noCost', { count: noCost })}` : ''}
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={onAdd}>
          <Plus className="h-5 w-5" /> {t('waste.add')}
        </button>
      </div>

      {data && moves.length === 0 && <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">{t('waste.empty')}</div>}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {moves.map((m) => {
          const p = data?.products.get(m.product_id);
          const value = valueOf(m);
          return (
            <li key={m.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div dir="auto" className="truncate font-medium">{p ? productName(p, lng) : '?'}</div>
                <div className="text-xs text-slate-500">
                  {new Date(m.created_at).toLocaleString(`${lng}-u-nu-latn`, { dateStyle: 'short', timeStyle: 'short' })}
                  {m.waste_reason ? ` · ${t(`waste.reasons.${m.waste_reason}`)}` : ''}
                  {m.note ? ` · ${m.note}` : ''}
                </div>
              </div>
              <div className="text-end">
                <div dir="ltr" className="font-semibold tabular-nums">−{Math.abs(m.delta)}{p && isWeighed(p) ? ' kg' : ''}</div>
                <div className="text-xs text-red-600">{value !== null ? money(value) : '—'}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
