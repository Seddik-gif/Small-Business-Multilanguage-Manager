import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { db } from '@/db';
import { Keypad } from '@/components/ui/Keypad';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { verifyPin } from '@/lib/pin';
import { useSession } from '@/stores/session';

const MAX_TRIES = 5;
const COOLDOWN_S = 30;

/** Full-screen PIN pad. Works offline: PINs are checked against the local staff table. */
export function PinLock() {
  const { t } = useTranslation();
  const unlock = useSession((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const submit = async (value: string) => {
    if (value.length < 4 || busy || cooldown > 0) return;
    setBusy(true);
    try {
      const staff = await db.staff.filter((s) => !s.deleted).toArray();
      for (const s of staff) {
        if (await verifyPin(value, s.pin_hash)) {
          unlock({ id: s.id, name: s.name, role: s.role });
          return;
        }
      }
      const n = tries + 1;
      setTries(n);
      setPin('');
      if (n >= MAX_TRIES) {
        setTries(0);
        setCooldown(COOLDOWN_S);
        setError(null);
      } else setError(t('lock.wrong'));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (k: string) => {
    setError(null);
    if (k === 'back') setPin((p) => p.slice(0, -1));
    else if (pin.length < 6) setPin((p) => p + k);
  };

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-slate-50 p-4">
      <div className="absolute end-4 top-4"><LanguageSwitcher /></div>
      <div className="flex flex-col items-center gap-2">
        <Lock className="h-10 w-10 text-emerald-600" />
        <h1 className="text-xl font-semibold">{t('auth.enterPin')}</h1>
      </div>
      <div dir="ltr" className="flex h-6 gap-3" aria-label={`${pin.length} digits`}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-slate-800' : 'bg-slate-300'}`} />
        ))}
      </div>
      <p className="h-5 text-sm text-red-600" role="alert">
        {cooldown > 0 ? t('lock.tooMany', { seconds: cooldown }) : error}
      </p>
      <div className="w-full max-w-xs space-y-2">
        <fieldset disabled={busy || cooldown > 0} className="disabled:opacity-50">
          <Keypad onKey={onKey} decimal={false} />
        </fieldset>
        <button type="button" className="btn-primary h-14 w-full text-lg" disabled={pin.length < 4 || busy || cooldown > 0} onClick={() => void submit(pin)}>
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
}
