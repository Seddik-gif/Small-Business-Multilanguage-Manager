import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CloudOff, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { useConnectivity } from '@/stores/connectivity';
import { SyncPanel } from './SyncPanel';

/**
 * Owner account (Supabase Auth, email + password). Signing in once links this device's local
 * data to the shop account; after that the device keeps working offline, and sync resumes
 * whenever the session is valid. Staff never use this: they switch with a PIN.
 */
export function AccountPanel() {
  const { t } = useTranslation();
  const { status, email, error } = useAuth();
  const online = useConnectivity((s) => s.online);
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'disabled' || !supabase) {
    return (
      <Card title={t('auth.account')}>
        <p className="flex items-center gap-2 text-sm text-slate-500"><CloudOff className="h-4 w-4" /> {t('auth.localMode')}</p>
      </Card>
    );
  }

  const run = async (fn: () => Promise<{ error: { message: string } | null; data?: { session: unknown } }>, signup = false) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      if (res.error) setMessage(res.error.message);
      else if (signup && !res.data?.session) setMessage(t('auth.checkEmail'));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'linked' || status === 'linking' || status === 'error') {
    return (
      <Card title={t('auth.account')}>
        {status === 'linked' && (
          <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {t('auth.signedInAs', { email })}</p>
        )}
        {status === 'linking' && <p className="text-sm text-slate-500">{t('auth.linking')}</p>}
        {status === 'error' && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error === 'linkedOther' ? t('auth.linkedOther') : t('auth.linkFailed')}</p>
        )}
        {status === 'linked' && <SyncPanel />}
        <button type="button" className="btn-secondary" onClick={() => void supabase!.auth.signOut()}>
          <LogOut className="h-5 w-5" /> {t('auth.signOut')}
        </button>
      </Card>
    );
  }

  return (
    <Card title={t('auth.account')}>
      <p className="text-sm text-slate-500">{t('auth.syncPaused')}</p>
      {!online && <p className="text-sm text-amber-700">{t('auth.needsOnline')}</p>}
      <input className="input" dir="ltr" type="email" autoComplete="email" placeholder={t('auth.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input className="input" dir="ltr" type="password" autoComplete="current-password" placeholder={t('auth.password')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      {message && <p className="text-sm text-red-600">{message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" disabled={busy || !online} onClick={() => void run(() => supabase!.auth.signUp(form), true)}>
          {t('auth.signUp')}
        </button>
        <button type="button" className="btn-primary" disabled={busy || !online} onClick={() => void run(() => supabase!.auth.signInWithPassword(form))}>
          {t('auth.signIn')}
        </button>
      </div>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}
