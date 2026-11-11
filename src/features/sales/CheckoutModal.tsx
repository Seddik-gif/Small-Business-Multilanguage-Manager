import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, NotebookPen } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Keypad, applyKey } from '@/components/ui/Keypad';
import { useMoney } from '@/hooks/useMoney';
import { useRole } from '@/hooks/useRole';
import { parseNum, round2 } from '@/lib/money';
import type { Customer, PaymentMethod } from '@/types/models';
import { CustomerPicker } from './CustomerPicker';

/** Smallest note values that cover the total, for one-tap "customer gave €20". */
function quickAmounts(total: number): number[] {
  const notes = [5, 10, 20, 50, 100];
  return notes.filter((n) => n >= total).slice(0, 3);
}

export interface CheckoutResult {
  method: PaymentMethod;
  /** Cash handed over (cash sales only), for the change line on the receipt. */
  tendered: number | null;
  /** Credit sales only. */
  customer: Customer | null;
  /** Credit sales only: paid now, the rest goes on the customer's debt. */
  deposit: number;
}

export function CheckoutModal({
  total, onClose, onComplete,
}: { total: number; onClose: () => void; onComplete: (r: CheckoutResult) => Promise<void> }) {
  const { t } = useTranslation();
  const money = useMoney();
  const { role } = useRole();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deposit, setDeposit] = useState('');
  const [busy, setBusy] = useState(false);

  const tenderedNum = tendered ? Number(tendered) : null;
  const short = method === 'cash' && tenderedNum !== null && tenderedNum < total;
  const change = method === 'cash' && tenderedNum !== null && !short ? round2(tenderedNum - total) : null;
  const depositNum = parseNum(deposit) ?? 0;
  const depositTooHigh = depositNum > total;
  const onCredit = round2(total - Math.min(depositNum, total));
  const invalid = busy || short || (method === 'credit' && (!customer || depositTooHigh || depositNum < 0));

  const methods: { id: PaymentMethod; icon: typeof Banknote }[] = [
    { id: 'cash', icon: Banknote },
    { id: 'card', icon: CreditCard },
    { id: 'credit', icon: NotebookPen },
  ];

  const submit = async () => {
    setBusy(true);
    try {
      await onComplete({
        method,
        tendered: method === 'cash' ? tenderedNum ?? total : null,
        customer: method === 'credit' ? customer : null,
        deposit: method === 'credit' ? round2(depositNum) : 0,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('checkout.title')}
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className="btn-primary h-14 w-full text-lg" disabled={invalid} onClick={() => void submit()}>
          {t('checkout.confirm')}
        </button>
      }
    >
      <div className="mb-4 text-center">
        <div className="text-sm text-slate-500">{t('common.total')}</div>
        <div className="text-4xl font-bold">{money(total)}</div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {methods.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMethod(id)}
            className={`btn h-16 flex-col gap-1 text-sm ${method === id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'}`}
          >
            <Icon className="h-5 w-5" /> {t(`payment.${id}`)}
          </button>
        ))}
      </div>

      {method === 'credit' && (
        <div className="space-y-3">
          <CustomerPicker value={customer} onChange={setCustomer} showDebt={role === 'owner'} />
          {!customer && <p className="text-xs text-slate-500">{t('checkout.customerRequired')}</p>}
          {customer && (
            <>
              <label className="block">
                <span className="label">{t('debt.deposit')}</span>
                <input className="input" dir="ltr" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" />
              </label>
              {depositTooHigh && <p className="text-sm text-red-600">{t('debt.depositTooHigh')}</p>}
              <div className="flex items-baseline justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-slate-600">{t('checkout.onCredit')}</span>
                <span className="text-2xl font-bold text-red-600">{money(onCredit)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {method === 'cash' && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
            <div>
              <div className="text-xs text-slate-500">{t('checkout.tendered')}</div>
              <div dir="ltr" className="text-2xl font-bold tabular-nums">{tendered ? money(Number(tendered)) : '—'}</div>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-500">{t('checkout.change')}</div>
              <div className={`text-2xl font-bold ${change !== null ? 'text-emerald-700' : 'text-slate-300'}`}>
                {change !== null ? money(change) : '—'}
              </div>
            </div>
          </div>
          {short && <p className="mb-2 text-sm text-red-600">{t('checkout.insufficient')}</p>}
          <div className="mb-3 grid grid-cols-4 gap-2">
            <button type="button" className="btn-secondary px-1 text-sm" onClick={() => setTendered(String(total))}>
              {t('checkout.exact')}
            </button>
            {quickAmounts(total).map((n) => (
              <button key={n} type="button" className="btn-secondary px-1" onClick={() => setTendered(String(n))}>
                €{n}
              </button>
            ))}
          </div>
          <Keypad onKey={(k) => setTendered((v) => applyKey(v, k, 2))} />
        </>
      )}
    </Modal>
  );
}
