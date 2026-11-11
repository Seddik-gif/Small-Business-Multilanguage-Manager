import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { db } from '@/db';
import { retryFailed } from '@/sync/push';
import { syncNow } from '@/sync/engine';
import { MAX_ATTEMPTS } from '@/sync/tables';
import { useConnectivity } from '@/stores/connectivity';

/** Sync status for the owner: last success, what is waiting, what the server refused, and why a cycle stopped. */
export function SyncPanel() {
  const { t, i18n } = useTranslation();
  const { syncing, lastSyncedAt, error, errorDetail, online } = useConnectivity();
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const failedEntries = useLiveQuery(() => db.outbox.filter((e) => e.attempts >= MAX_ATTEMPTS).toArray(), []) ?? [];
  const lng = i18n.resolvedLanguage ?? 'it';
  const time = lastSyncedAt ? new Date(lastSyncedAt).toLocaleString(`${lng}-u-nu-latn`) : null;

  const message =
    error === 'network' ? t('sync.errNetwork')
    : error === 'auth' ? t('sync.errAuth')
    : error === 'server' ? t('sync.errServer')
    : null;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <h3 className="text-sm font-semibold">{t('sync.title')}</h3>
      <p className="text-sm text-slate-600">{time ? t('sync.last', { time }) : t('sync.never')}</p>
      <p className="text-sm text-slate-600">{pending === 0 ? t('sync.upToDate') : t('sync.pending', { count: pending })}</p>
      {message && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{message}</p>}
      {failedEntries.length > 0 && (
        <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
          <p>{t('sync.failed', { count: failedEntries.length })}</p>
          {failedEntries[0].last_error && <p dir="ltr" className="mt-1 break-words font-mono text-xs">{failedEntries[0].last_error}</p>}
        </div>
      )}
      {errorDetail && error !== 'rows' && <p dir="ltr" className="break-words font-mono text-xs text-slate-400">{errorDetail}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={syncing || !online} onClick={() => void syncNow()}>
          <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} /> {t('sync.now')}
        </button>
        {failedEntries.length > 0 && (
          <button type="button" className="btn-danger" onClick={() => void retryFailed().then(() => syncNow())}>
            {t('sync.retry')}
          </button>
        )}
      </div>
    </div>
  );
}
