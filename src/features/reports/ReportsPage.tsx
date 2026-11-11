import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExportTab } from './ExportTab';
import { ProductsTab } from './ProductsTab';
import { ZReportTab } from './ZReportTab';

type Tab = 'z' | 'products' | 'export';
const TABS: Tab[] = ['z', 'products', 'export'];

/** Report: closing the day, top sellers and margins, CSV export. Owner only (costs and profit). */
export function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('z');
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.reports')}</h1>
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
        {TABS.map((id) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={`btn flex-1 whitespace-nowrap ${tab === id ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
            {t(`reports.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'z' && <ZReportTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'export' && <ExportTab />}
    </section>
  );
}
