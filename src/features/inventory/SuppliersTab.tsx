import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { saveRecord, softDelete, stamp } from '@/db/repo';
import { Modal } from '@/components/ui/Modal';
import type { Supplier } from '@/types/models';

export function SuppliersTab() {
  const { t } = useTranslation();
  const suppliers = useLiveQuery(() => db.suppliers.filter((s) => !s.deleted).toArray(), []);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const sorted = [...(suppliers ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
        <Plus className="h-5 w-5" /> {t('suppliers.add')}
      </button>
      {suppliers?.length === 0 && <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">{t('suppliers.empty')}</div>}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {sorted.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => setEditing(s)} className="flex min-h-14 w-full flex-col items-start justify-center p-3 text-start hover:bg-slate-50">
              <span dir="auto" className="font-medium">{s.name}</span>
              <span dir="ltr" className="text-sm text-slate-500">{[s.phone, s.email].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
      {editing && <SupplierForm supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SupplierForm({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [notes, setNotes] = useState(supplier?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError(t('suppliers.nameRequired'));
    await saveRecord(
      'suppliers',
      stamp<Supplier>({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null }, supplier ?? undefined),
    );
    onClose();
  };

  const remove = async () => {
    if (!supplier || !window.confirm(t('suppliers.deleteConfirm', { name: supplier.name }))) return;
    await softDelete('suppliers', supplier.id);
    onClose();
  };

  return (
    <Modal
      title={supplier ? t('suppliers.edit') : t('suppliers.add')}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {supplier && (
            <button type="button" className="btn-danger" onClick={() => void remove()}>
              <Trash2 className="h-5 w-5" /> {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn-secondary ms-auto" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" onClick={() => void save()}>{t('common.save')}</button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block"><span className="label">{t('customers.name')}</span>
          <input className="input" dir="auto" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label className="block"><span className="label">{t('customers.phone')}</span>
          <input className="input" dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="block"><span className="label">Email</span>
          <input className="input" dir="ltr" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block"><span className="label">{t('customers.notes')}</span>
          <textarea className="input min-h-20 py-2" dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>
    </Modal>
  );
}
