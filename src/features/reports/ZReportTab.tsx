import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { db } from '@/db';
import { useMoney } from '@/hooks/useMoney';
import { parseNum, round2 } from '@/lib/money';
import { useAuth } from '@/stores/auth';
import { useConnectivity } from '@/stores/connectivity';
import { zReport } from './compute';
import { addDays, loadReport, today } from './data';
import { ZSlip } from './ZSlip';

const METHODS = ['cash', 'card', 'credit'] as const;
const BAR = { cash: 'bg-emerald-500', card: 'bg-sky-500', credit: 'bg-amber-500' } as const;

/** Chiusura di giornata: what was sold today, how it was paid, IVA, and a cash count. */
export function ZReportTab() {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = useMoney();
  const [day, setDay] = useState(today());
  const [counted, setCounted] = useState('');
  const data = useLiveQuery(() => loadReport({ from: day, to: day }), [day]);
  const staff = useLiveQuery(() => db.staff.toArray(), []);
  const linked = useAuth((s) => s.status === 'linked');
  const lastSynced = useConnectivity((s) => s.lastSyncedAt);
  const z = useMemo(() => (data ? zReport(data) : null), [data]);

  const staffName = (id: string | null) => (id ? staff?.find((s) => s.id === id)?.name ?? '?' : t('reports.unknownStaff'));
  const countedNum = parseNum(counted);
  const diff = z && countedNum !== null ? round2(countedNum - z.expectedCash) : null;
  const isToday = day === today();
  const pretty = new Date(`${day}T12:00:00`).toLocaleDateString(`${lng}-u-nu-latn`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-icon bg-white ring-1 ring-slate-200" onClick={() => setDay(addDays(day, -1))} aria-label={t('reports.prevDay')}>
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <input type="date" className="input w-auto" dir="ltr" max={today()} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label={t('reports.day')} />
        <button type="button" className="btn-icon bg-white ring-1 ring-slate-200" disabled={isToday} onClick={() => setDay(addDays(day, 1))} aria-label={t('reports.nextDay')}>
          <ChevronRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        {!isToday && <button type="button" className="btn-secondary" onClick={() => setDay(today())}>{t('reports.period.today')}</button>}
        <button type="button" className="btn-primary ms-auto" disabled={!z} onClick={() => window.print()}>
          <Printer className="h-5 w-5" /> {t('common.print')}
        </button>
      </div>
      <p className="text-sm capitalize text-slate-500">{pretty}</p>

      {z && z.count === 0 && z.customerPayments.count === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">{t('reports.noSales')}</div>
      )}

      {z && (z.count > 0 || z.customerPayments.count > 0) && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label={t('reports.sold')} value={money(z.gross)} big />
            <Tile label={t('reports.salesCount')} value={String(z.count)} />
            <Tile label={t('reports.average')} value={money(z.average)} />
          </div>

          <Card title={t('reports.byMethod')}>
            <ul className="space-y-3">
              {METHODS.map((m) => {
                const v = z.byMethod[m];
                const share = z.gross > 0 ? (v.amount / z.gross) * 100 : 0;
                return (
                  <li key={m}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{t(`payment.${m}`)} <span className="text-sm font-normal text-slate-500">· {v.count}</span></span>
                      <span className="font-semibold tabular-nums">{money(v.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${BAR[m]}`} style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            {z.discount > 0 && <p className="mt-3 text-sm text-slate-500">{t('reports.discounts')}: {money(z.discount)}</p>}
          </Card>

          <Card title={t('reports.collected')}>
            <dl className="space-y-1.5">
              <Line label={t('reports.customerPayments')} value={`${money(z.customerPayments.amount)}`} hint={`${z.customerPayments.count}`} />
              <Line label={t('reports.collected')} value={money(z.collected)} bold />
              <Line label={t('reports.expectedCash')} value={money(z.expectedCash)} />
            </dl>
            <p className="mt-2 text-xs text-slate-500">{t('reports.expectedCashHint')}</p>
            <label className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-medium">{t('reports.counted')}</span>
              <input className="input w-36 text-end" dir="ltr" inputMode="decimal" placeholder="0,00" value={counted} onChange={(e) => setCounted(e.target.value)} />
              {diff !== null && (
                <span className={`font-semibold tabular-nums ${diff === 0 ? 'text-emerald-700' : diff > 0 ? 'text-sky-700' : 'text-red-600'}`}>
                  {diff === 0 ? t('reports.match') : `${diff > 0 ? t('reports.over') : t('reports.short')} ${money(Math.abs(diff))}`}
                </span>
              )}
            </label>
          </Card>

          {z.vat.length > 0 && (
            <Card title={t('receipt.vat')}>
              <table className="w-full text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-start font-normal">{t('receipt.vat')}</th>
                    <th className="text-end font-normal">{t('reports.revenue')}</th>
                    <th className="text-end font-normal">{t('receipt.taxable')}</th>
                    <th className="text-end font-normal">{t('receipt.vat')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {z.vat.map((v) => (
                    <tr key={v.rate}>
                      <td className="py-1">{v.rate}%</td>
                      <td className="text-end">{money(v.gross)}</td>
                      <td className="text-end">{money(v.taxable)}</td>
                      <td className="text-end">{money(v.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {z.byStaff.length > 1 && (
            <Card title={t('reports.byStaff')}>
              <dl className="space-y-1.5">
                {z.byStaff.map((s) => <Line key={s.staffId ?? 'none'} label={`${staffName(s.staffId)} · ${s.count}`} value={money(s.amount)} />)}
              </dl>
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-slate-500">
        {linked && lastSynced
          ? t('reports.syncNote', { time: new Date(lastSynced).toLocaleString(`${lng}-u-nu-latn`) })
          : t('reports.localNote')}
      </p>
      {z && <ZSlip day={day} z={z} staffName={staffName} counted={countedNum} />}
    </div>
  );
}

function Tile({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`font-bold tabular-nums ${big ? 'text-3xl text-emerald-700' : 'text-2xl'}`}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Line({ label, value, hint, bold }: { label: string; value: string; hint?: string; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${bold ? 'font-semibold' : ''}`}>
      <dt className="min-w-0">{label}{hint && <span className="text-sm font-normal text-slate-500"> · {hint}</span>}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
