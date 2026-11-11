import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { saveRecord, softDelete, stamp } from '@/db/repo';
import { Modal } from '@/components/ui/Modal';
import { LANGUAGES } from '@/i18n';
import { normalizePhone } from '@/lib/phone';
import type { Customer } from '@/types/models';
import { loadBalances } from './debt';

/** Create or edit a customer. Deleting is blocked while they still owe money. */
export function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved?: (c: Customer) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [lang, setLang] = useState(customer?.language_preference ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError(t('customers.nameRequired'));
    if (phone.trim() && !normalizePhone(phone)) return setError(t('customers.phoneInvalid'));
    setBusy(true);
    try {
      const row = await saveRecord(
        'customers',
        stamp<Customer>(
          { name: name.trim(), phone: phone.trim() || null, language_preference: lang || null, notes: notes.trim() || null },
          customer ?? undefined,
        ),
      );
      onSaved?.(row);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!customer) return;
    if ((await loadBalances()).get(customer.id)) return setError(t('customers.hasDebt'));
    if (!window.confirm(t('customers.deleteConfirm', { name: customer.name }))) return;
    await softDelete('customers', customer.id);
    onClose();
  };

  return (
    <Modal
      title={customer ? t('customers.edit') : t('customers.add')}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {customer && (
            <button type="button" className="btn-danger" onClick={() => void remove()}>
              <Trash2 className="h-5 w-5" /> {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn-secondary ms-auto" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>{t('common.save')}</button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block">
          <span className="label">{t('customers.name')}</span>
          <input className="input" dir="auto" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="block">
          <span className="label">{t('customers.phone')}</span>
          <input className="input" dir="ltr" type="tel" inputMode="tel" placeholder="+39 333 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <span className="mt-1 block text-xs text-slate-500">{t('customers.phoneHint')}</span>
        </label>
        <label className="block">
          <span className="label">{t('customers.language')}</span>
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">{t('customers.languageDefault')}</option>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">{t('customers.notes')}</span>
          <textarea className="input min-h-20 py-2" dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
