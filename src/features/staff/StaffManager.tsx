import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, UserPlus } from 'lucide-react';
import { db } from '@/db';
import { saveRecord, softDelete, stamp } from '@/db/repo';
import { PIN_RE, hashPin, verifyPin } from '@/lib/pin';
import { useSession } from '@/stores/session';
import type { Role, Staff } from '@/types/models';

/** Owner-only: add/remove staff and their PINs. The first PIN created is always an owner. */
export function StaffManager() {
  const { t, i18n } = useTranslation();
  const staff = useLiveQuery(() => db.staff.filter((s) => !s.deleted).toArray(), []) ?? [];
  const unlock = useSession((s) => s.unlock);
  const first = staff.length === 0;
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const add = async () => {
    // Ref, not state: a double-tap fires twice before React re-renders with busy=true.
    if (busyRef.current) return;
    setError(null);
    if (!name.trim()) return;
    if (!PIN_RE.test(pin)) return setError(t('staff.pinInvalid'));
    busyRef.current = true;
    setBusy(true);
    try {
      // PINs identify the person, so two staff members can't share one. Read fresh from the DB:
      // the rendered list can be stale while PBKDF2 runs.
      const current = await db.staff.filter((s) => !s.deleted).toArray();
      for (const s of current) if (await verifyPin(pin, s.pin_hash)) return setError(t('staff.pinTaken'));
      const isFirst = current.length === 0;
      const row = await saveRecord(
        'staff',
        // New people start in the language the till is in now; they change it once and it follows them.
        stamp<Staff>({ name: name.trim(), role: isFirst ? 'owner' : role, pin_hash: await hashPin(pin), language_preference: i18n.resolvedLanguage ?? 'it' }),
      );
      // Creating the first PIN turns the lock on: keep the creator signed in as that owner.
      if (isFirst) unlock({ id: row.id, name: row.name, role: row.role });
      setName('');
      setPin('');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const remove = async (s: Staff) => {
    const owners = staff.filter((x) => x.role === 'owner');
    if (s.role === 'owner' && owners.length === 1) return setError(t('staff.lastOwner'));
    if (window.confirm(t('staff.deleteConfirm', { name: s.name }))) await softDelete('staff', s.id);
  };

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{first ? t('staff.createOwner') : t('staff.title')}</h2>
      {first && <p className="text-sm text-slate-500">{t('staff.createOwnerHint')}</p>}
      {staff.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-1">
              <span dir="auto" className="flex-1">{s.name}</span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">{t(`role.${s.role}`)}</span>
              <button type="button" className="btn-icon text-red-600 hover:bg-red-50" onClick={() => void remove(s)} aria-label={t('common.delete')}>
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" dir="auto" placeholder={t('staff.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="input"
          dir="ltr"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder={t('staff.pin')}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>
      {!first && (
        <div className="grid grid-cols-2 gap-2">
          {(['cashier', 'owner'] as Role[]).map((r) => (
            <button key={r} type="button" className={`btn ${role === r ? 'bg-slate-800 text-white' : 'bg-slate-100'}`} onClick={() => setRole(r)}>
              {t(`role.${r}`)}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn-primary w-full" disabled={busy || !name.trim() || !pin} onClick={() => void add()}>
        <UserPlus className="h-5 w-5" /> {first ? t('staff.createOwner') : t('staff.add')}
      </button>
    </div>
  );
}
