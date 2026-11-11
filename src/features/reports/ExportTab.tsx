import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { db } from '@/db';
import { productName } from '@/lib/product';
import { dailyRows, productStats } from './compute';
import { dailySummaryRows, downloadCsv, productSummaryRows, salesLinesRows, toCsv, type CsvContext, type CsvFormat } from './csv';
import { loadReport, type Period } from './data';
import { PeriodPicker, presetPeriod } from './PeriodPicker';

type Kind = 'sales' | 'products' | 'daily';
const KINDS: Kind[] = ['sales', 'products', 'daily'];
const FILE: Record<Kind, string> = { sales: 'vendite', products: 'prodotti', daily: 'giornaliero' };

/** CSV files for a spreadsheet. Built on this device from its own data. */
export function ExportTab() {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const [period, setPeriod] = useState<Period>(() => presetPeriod('month'));
  const [format, setFormat] = useState<CsvFormat>('it');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (kind: Kind) => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await loadReport(period);
      const [staff, customers] = await Promise.all([db.staff.toArray(), db.customers.toArray()]);
      const ctx: CsvContext = {
        t,
        productName: (p) => productName(p, lng),
        staffName: (id) => (id ? staff.find((s) => s.id === id)?.name ?? '?' : ''),
        customerName: (c) => c?.name ?? '?',
        customers: new Map(customers.map((c) => [c.id, c])),
      };
      const rows =
        kind === 'sales'
          ? salesLinesRows(data, ctx)
          : kind === 'products'
            ? productSummaryRows(productStats(data).stats, (id) => data.products.get(id), ctx)
            : dailySummaryRows(dailyRows(data), ctx);
      const dataRows = rows.length - 1; // header excluded
      if (dataRows <= 0) return setMessage(t('reports.nothingToExport'));
      downloadCsv(`${FILE[kind]}_${period.from}_${period.to}.csv`, toCsv(rows, format));
      setMessage(t('reports.exported', { count: dataRows }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PeriodPicker value={period} onChange={setPeriod} />
      <label className="block max-w-md">
        <span className="label">{t('reports.format')}</span>
        <select className="input" value={format} onChange={(e) => setFormat(e.target.value as CsvFormat)}>
          <option value="it">{t('reports.formatIt')}</option>
          <option value="intl">{t('reports.formatIntl')}</option>
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button key={k} type="button" className="btn-secondary h-auto min-h-14 flex-col gap-1 py-3 text-center" disabled={busy} onClick={() => void run(k)}>
            <Download className="h-5 w-5" />
            <span className="text-sm">{t(`reports.export.${k}`)}</span>
          </button>
        ))}
      </div>
      {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
    </div>
  );
}
