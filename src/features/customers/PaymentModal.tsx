import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveRecord, stamp } from '@/db/repo';
import { Keypad, applyKey } from '@/components/ui/Keypad';
import { Modal } from '@/components/ui/Modal';
import { useMoney } from '@/hooks/useMoney';
import { nowIso } from '@/lib/id';
import { round2 } from '@/lib/money';
import type { Customer, DebtPayment } from '@/types/models';

/** Record a (partial) payment against a customer's debt. Capped at what they owe. */
export function PaymentModal({ customer, balance, onClose }: { customer: Customer; balance: number; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const amount = Number(value) || 0;
  const tooMuch = amount > balance;

  const save = async () => {
    if (amount <= 0 || tooMuch || busy) return;
    setBusy(true);
    try {
      await saveRecord(
        'debt_payments',
        stamp<DebtPayment>({ customer_id: customer.id, amount: round2(amount), payment_date: nowIso(), notes: notes.trim() || null }),
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`${t('debt.addPayment')} · ${customer.name}`}
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className="btn-primary h-14 w-full text-lg" disabled={amount <= 0 || tooMuch || busy} onClick={() => void save()}>
          {t('common.confirm')} · {money(amount)}
        </button>
      }
    >
      <div className="mb-3 rounded-xl bg-slate-50 p-3 text-center">
        <div className="text-xs text-slate-500">{t('debt.balance')}: {money(balance)}</div>
        <div dir="ltr" className="text-4xl font-bold tabular-nums">{value || '0'}<span className="text-2xl text-slate-500"> €</span></div>
        {tooMuch && <div className="mt-1 text-sm text-red-600">{t('debt.exceeds', { amount: money(balance) })}</div>}
      </div>
      <button type="button" className="btn-secondary mb-3 w-full" onClick={() => setValue(String(balance))}>
        {t('debt.payAll')} · {money(balance)}
      </button>
      <Keypad onKey={(k) => setValue((v) => applyKey(v, k, 2))} />
      <input className="input mt-3" dir="auto" placeholder={t('debt.paymentNote')} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </Modal>
  );
}
