import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMoney } from '@/hooks/useMoney';
import { productName } from '@/lib/product';
import { productStats } from './compute';
import { loadReport, type Period } from './data';
import { PeriodPicker, presetPeriod } from './PeriodPicker';

const TOP = 15;

/** Top sellers and profit margin for a period. */
export function ProductsTab() {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = useMoney();
  const [period, setPeriod] = useState<Period>(() => presetPeriod('week'));
  const [sort, setSort] = useState<'revenue' | 'margin'>('revenue');
  const [all, setAll] = useState(false);
  const data = useLiveQuery(() => loadReport(period), [period.from, period.to]);
  const result = useMemo(() => (data ? { ...productStats(data), products: data.products } : null), [data]);

  const rows = useMemo(() => {
    if (!result) return [];
    return [...result.stats].sort((a, b) => (sort === 'revenue' ? b.gross - a.gross : (b.margin ?? -Infinity) - (a.margin ?? -Infinity)));
  }, [result, sort]);
  const shown = all ? rows : rows.slice(0, TOP);
  const nf = new Intl.NumberFormat(`${lng}-u-nu-latn`, { maximumFractionDigits: 3 });
  const totals = result?.totals;

  return (
    <div className="space-y-4">
      <PeriodPicker value={period} onChange={(p) => { setPeriod(p); setAll(false); }} />

      {result && result.stats.length === 0 && <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">{t('reports.noData')}</div>}

      {totals && result!.stats.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t('reports.revenue')} value={money(totals.gross)} />
            <Tile label={t('reports.revenueNet')} value={money(totals.net)} />
            <Tile label={t('reports.cost')} value={totals.margin === null ? '—' : money(totals.cost)} />
            <Tile
              label={t('reports.margin')}
              value={totals.margin === null ? '—' : money(totals.margin)}
              sub={totals.marginPct === null ? undefined : `${(totals.marginPct * 100).toFixed(1)}%`}
              tone={totals.margin === null ? undefined : totals.margin >= 0 ? 'good' : 'bad'}
            />
          </div>

          {totals.margin === null && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t('reports.noCostAtAll')}</p>}
          {totals.margin !== null && totals.coverage < 0.999 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {t('reports.coverage', { pct: Math.round(totals.coverage * 100), count: totals.unknownLines })}
            </p>
          )}
          {totals.estimatedLines > 0 && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">{t('reports.estimated', { count: totals.estimatedLines })}</p>}

          <div className="flex flex-wrap gap-2">
            {(['revenue', 'margin'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={sort === s} className={`btn ${sort === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`} onClick={() => setSort(s)}>
                {t(s === 'revenue' ? 'reports.sortRevenue' : 'reports.sortMargin')}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="w-8 p-3 text-start font-normal">#</th>
                  <th className="p-3 text-start font-normal">{t('waste.product')}</th>
                  <th className="p-3 text-end font-normal">{t('reports.quantity')}</th>
                  <th className="p-3 text-end font-normal">{t('reports.revenue')}</th>
                  <th className="p-3 text-end font-normal">{t('reports.margin')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {shown.map((s, i) => {
                  const p = result!.products.get(s.productId);
                  return (
                    <tr key={s.productId}>
                      <td className="p-3 text-slate-400">{i + 1}</td>
                      <td dir="auto" className="p-3 font-sans font-medium">{p ? productName(p, lng) : '?'}</td>
                      <td dir="ltr" className="p-3 text-end">{nf.format(s.quantity)} {s.weighed ? 'kg' : ''}</td>
                      <td className="p-3 text-end">{money(s.gross)}</td>
                      <td className={`p-3 text-end ${s.margin === null ? 'text-slate-300' : s.margin < 0 ? 'text-red-600' : ''}`}>
                        {s.margin === null ? '—' : money(s.margin)}
                        {s.marginPct !== null && <span className="block text-xs text-slate-500">{(s.marginPct * 100).toFixed(1)}%</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > TOP && (
            <button type="button" className="btn-secondary w-full" onClick={() => setAll((v) => !v)}>
              {all ? t('reports.showTop', { count: TOP }) : t('reports.showAll', { count: rows.length })}
            </button>
          )}
          <p className="text-xs text-slate-500">{t('reports.marginNote')}</p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : ''}`}>{value}</div>
      {sub && <div className="text-sm text-slate-500">{sub}</div>}
    </div>
  );
}
