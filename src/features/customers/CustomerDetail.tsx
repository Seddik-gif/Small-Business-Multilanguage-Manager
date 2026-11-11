import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { HandCoins, MessageCircle, Pencil, Receipt, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { softDelete } from '@/db/repo';
import { Modal } from '@/components/ui/Modal';
import { useMoney } from '@/hooks/useMoney';
import { ReceiptModal } from '@/features/receipt/ReceiptModal';
import { CustomerForm } from './CustomerForm';
import { PaymentModal } from './PaymentModal';
import { ReminderModal } from './ReminderModal';
import { loadLedger } from './debt';

/** One customer: what they owe, every credit sale and payment (newest first), and the actions. */
export function CustomerDetail({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId]);
  const ledger = useLiveQuery(() => loadLedger(customerId), [customerId]);
  const [paying, setPaying] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);

  if (!customer || customer.deleted) return null;
  const balance = ledger?.balance ?? 0;
  const lng = i18n.resolvedLanguage ?? 'it';
  const when = (iso: string) => new Date(iso).toLocaleString(`${lng}-u-nu-latn`, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Modal title={customer.name} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-500">{balance > 0 ? t('debt.balance') : t('debt.settled')}</div>
            <div className={`text-3xl font-bold tabular-nums ${balance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(balance)}</div>
            <div dir="ltr" className="truncate text-sm text-slate-500">{customer.phone ?? t('customers.noPhone')}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={balance <= 0} onClick={() => setPaying(true)}>
              <HandCoins className="h-5 w-5" /> {t('debt.addPayment')}
            </button>
            <button type="button" className="btn-secondary" disabled={balance <= 0} onClick={() => setReminding(true)}>
              <MessageCircle className="h-5 w-5" /> WhatsApp
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)} aria-label={t('common.edit')}>
              <Pencil className="h-5 w-5" />
            </button>
          </div>
        </div>
        {customer.notes && <p dir="auto" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{customer.notes}</p>}

        <h3 className="font-semibold">{t('debt.ledger')}</h3>
        {ledger && ledger.entries.length === 0 && <p className="text-slate-500">{t('debt.noMovements')}</p>}
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {[...(ledger?.entries ?? [])].reverse().map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {e.kind === 'sale' ? `${t('debt.sale')} #${e.sale.id.slice(0, 8).toUpperCase()}` : t('debt.payment')}
                </div>
                <div className="text-xs text-slate-500">
                  {when(e.date)}
                  {e.kind === 'payment' && e.payment.notes ? ` · ${e.payment.notes}` : ''}
                </div>
              </div>
              <div className="text-end">
                <div className={`font-semibold tabular-nums ${e.kind === 'sale' ? 'text-red-600' : 'text-emerald-700'}`}>
                  {e.kind === 'sale' ? '+' : '−'}{money(Math.abs(e.amount))}
                </div>
                <div className="text-xs text-slate-500">{t('debt.balanceAfter')} {money(e.balance)}</div>
              </div>
              {e.kind === 'sale' ? (
                <button type="button" className="btn-icon text-slate-500 hover:bg-slate-100" onClick={() => setReceiptFor(e.sale.id)} aria-label={t('debt.receipt')}>
                  <Receipt className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-icon text-red-600 hover:bg-red-50"
                  aria-label={t('common.delete')}
                  onClick={() => window.confirm(t('debt.deletePayment')) && void softDelete('debt_payments', e.payment.id)}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {paying && <PaymentModal customer={customer} balance={balance} onClose={() => setPaying(false)} />}
      {reminding && <ReminderModal customer={customer} balance={balance} onClose={() => setReminding(false)} />}
      {editing && <CustomerForm customer={customer} onClose={() => setEditing(false)} />}
      {receiptFor && <ReceiptModal saleId={receiptFor} onClose={() => setReceiptFor(null)} />}
    </Modal>
  );
}
