import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { UserPlus, X } from 'lucide-react';
import { db } from '@/db';
import { saveRecord, stamp } from '@/db/repo';
import { useBalances } from '@/features/customers/debt';
import { useMoney } from '@/hooks/useMoney';
import { normalizePhone } from '@/lib/phone';
import type { Customer } from '@/types/models';

/**
 * Pick (or quickly add) the customer for a credit sale. Cashiers see names and phones only: what
 * a customer owes is for the owner (showDebt), in line with "no cost/profit visibility" for cashiers.
 */
export function CustomerPicker({ value, onChange, showDebt }: { value: Customer | null; onChange: (c: Customer | null) => void; showDebt: boolean }) {
  const { t } = useTranslation();
  const money = useMoney();
  const customers = useLiveQuery(() => db.customers.filter((c) => !c.deleted).toArray(), []);
  const balances = useBalances();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return (customers ?? [])
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && (normalizePhone(c.phone ?? '') ?? '').includes(digits)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [customers, query]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3">
        <div className="min-w-0 flex-1">
          <div dir="auto" className="truncate font-semibold">{value.name}</div>
          {showDebt && <div className="text-xs text-slate-600">{t('debt.balance')}: {money(balances?.get(value.id) ?? 0)}</div>}
        </div>
        <button type="button" className="btn-icon text-slate-500 hover:bg-white" onClick={() => onChange(null)} aria-label={t('common.clear')}>
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }

  const addNew = async () => {
    setError(null);
    if (!query.trim()) return setError(t('customers.nameRequired'));
    if (phone.trim() && !normalizePhone(phone)) return setError(t('customers.phoneInvalid'));
    const row = await saveRecord('customers', stamp<Customer>({ name: query.trim(), phone: phone.trim() || null, language_preference: null, notes: null }));
    onChange(row);
  };

  return (
    <div className="space-y-2">
      <input className="input" dir="auto" value={query} onChange={(e) => { setQuery(e.target.value); setError(null); }} placeholder={t('checkout.searchCustomer')} />
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
        {matches.map((c) => (
          <li key={c.id}>
            <button type="button" className="flex min-h-11 w-full items-center gap-2 px-3 py-1 text-start hover:bg-slate-50" onClick={() => onChange(c)}>
              <span dir="auto" className="min-w-0 flex-1 truncate">{c.name}</span>
              <span dir="ltr" className="text-xs text-slate-400">{c.phone}</span>
              {showDebt && (balances?.get(c.id) ?? 0) > 0 && <span className="text-sm font-semibold text-red-600">{money(balances!.get(c.id)!)}</span>}
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{t('checkout.noCustomerFound')}</li>}
      </ul>
      {!adding ? (
        <button type="button" className="btn-secondary w-full" onClick={() => setAdding(true)}>
          <UserPlus className="h-5 w-5" /> {t('checkout.newCustomer')}
        </button>
      ) : (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{t('checkout.newCustomerHint')}</p>
          <input className="input" dir="ltr" type="tel" inputMode="tel" placeholder={`${t('customers.phone')} (+39 …)`} value={phone} onChange={(e) => setPhone(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" className="btn-primary w-full" onClick={() => void addNew()}>{t('common.add')}</button>
        </div>
      )}
    </div>
  );
}
