import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { MAX_ATTEMPTS } from '@/sync/tables';
import { useConnectivity } from '@/stores/connectivity';

export function OnlineIndicator() {
  const { t } = useTranslation();
  const { online, syncing, error } = useConnectivity();
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const failed = useLiveQuery(() => db.outbox.filter((e) => e.attempts >= MAX_ATTEMPTS).count(), []) ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-sm" aria-live="polite">
      <span className={`h-3 w-3 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{syncing ? t('status.syncing') : online ? t('status.online') : t('status.offline')}</span>
      {pending > 0 && <span className="text-slate-500">· {t('status.pending', { count: pending })}</span>}
      {failed > 0 && <span className="text-red-600">· {t('status.failed', { count: failed })}</span>}
      {error === 'auth' && <span className="text-amber-700">· {t('status.signInAgain')}</span>}
    </div>
  );
}
