import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search } from 'lucide-react';
import { db } from '@/db';
import { useMoney } from '@/hooks/useMoney';
import { normalizePhone } from '@/lib/phone';
import { CustomerDetail } from './CustomerDetail';
import { CustomerForm } from './CustomerForm';
import { useBalances } from './debt';

export function CustomersPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const customers = useLiveQuery(() => db.customers.filter((c) => !c.deleted).toArray(), []);
  const balances = useBalances();
  const [query, setQuery] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return (customers ?? [])
      .map((c) => ({ c, balance: balances?.get(c.id) ?? 0 }))
      .filter(({ c, balance }) => {
        if (onlyDebt && balance <= 0) return false;
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || (digits.length >= 3 && (normalizePhone(c.phone ?? '') ?? '').includes(digits));
      })
      .sort((a, b) => b.balance - a.balance || a.c.name.localeCompare(b.c.name));
  }, [customers, balances, query, onlyDebt]);

  const totalOwed = [...(balances?.values() ?? [])].filter((v) => v > 0).reduce((s, v) => s + v, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="me-auto text-2xl font-bold">{t('nav.customers')}</h1>
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          <Plus className="h-5 w-5" /> {t('customers.add')}
        </button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">{t('customers.totalOwed')}</div>
        <div className={`text-3xl font-bold tabular-nums ${totalOwed > 0 ? 'text-red-600' : 'text-slate-800'}`}>{money(Math.round(totalOwed * 100) / 100)}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className="input ps-10" dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('checkout.searchCustomer')} />
        </div>
        {[false, true].map((v) => (
          <button key={String(v)} type="button" className={`btn ${onlyDebt === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`} onClick={() => setOnlyDebt(v)}>
            {v ? t('customers.filterDebt') : t('customers.filterAll')}
          </button>
        ))}
      </div>

      {customers?.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">{t('customers.empty')}</div>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {rows.map(({ c, balance }) => (
          <li key={c.id}>
            <button type="button" onClick={() => setOpenId(c.id)} className="flex min-h-14 w-full items-center gap-3 p-3 text-start hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div dir="auto" className="truncate font-medium">{c.name}</div>
                <div dir="ltr" className="truncate text-sm text-slate-500 text-start">{c.phone ?? t('customers.noPhone')}</div>
              </div>
              <div className={`font-semibold tabular-nums ${balance > 0 ? 'text-red-600' : 'text-slate-400'}`}>{money(balance)}</div>
            </button>
          </li>
        ))}
      </ul>

      {adding && <CustomerForm customer={null} onClose={() => setAdding(false)} onSaved={(c) => setOpenId(c.id)} />}
      {openId && <CustomerDetail customerId={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}
