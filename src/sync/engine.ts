import { db } from '@/db';
import { supabase } from '@/lib/supabase';
import { getOwnerUid } from '@/lib/shop';
import { nowIso } from '@/lib/id';
import { allRowsOwnedBy, linkDeviceToAccount } from '@/auth/linkDevice';
import { useAuth } from '@/stores/auth';
import { useConnectivity } from '@/stores/connectivity';
import { classify, SyncAbort } from './errors';
import { pullPhotos, pushPhotos } from './photos';
import { pullAll } from './pull';
import { pushOutbox } from './push';

/**
 * One sync cycle, always in this order:
 *   gate → photos up → rows up (parents first) → rows down → server stock recompute → photos down
 * Photos go first because uploading one edits its product (image_url), and that edit must ride the
 * same push. Wire format: sync/serialize.ts (never sends sync_status or products.stock_quantity).
 */
export async function canSync(): Promise<boolean> {
  const { online } = useConnectivity.getState();
  const { status, uid } = useAuth.getState();
  if (!online || !supabase || status !== 'linked' || !uid || getOwnerUid() !== uid) return false;
  await linkDeviceToAccount(uid); // idempotent: repairs a crash between the migration and its flag
  return allRowsOwnedBy(uid);
}

let running = false;
let again = false;

export async function syncNow(): Promise<void> {
  if (running) {
    again = true; // a change arrived mid-cycle: go once more when this one ends
    return;
  }
  running = true;
  const conn = useConnectivity.getState();
  conn.setSyncing(true);
  try {
    if (!(await canSync())) return;
    const uid = useAuth.getState().uid!;

    await pushPhotos(uid);
    const push = await pushOutbox();
    if (push.abort) {
      conn.setSyncResult({ error: push.abort, detail: push.lastError });
      return;
    }
    await pullAll(uid);
    await pullPhotos();
    conn.setSyncResult({ error: push.failed > 0 ? 'rows' : null, detail: push.lastError, at: nowIso() });
  } catch (e) {
    if (e instanceof SyncAbort) conn.setSyncResult({ error: e.kind, detail: e.message });
    else {
      console.error('Sync cycle failed', e);
      const kind = classify(e as Error);
      conn.setSyncResult({ error: kind === 'network' || kind === 'auth' ? kind : 'server', detail: (e as Error).message });
    }
  } finally {
    running = false;
    conn.setSyncing(false);
    if (again) {
      again = false;
      schedule(2000);
    }
  }
}

let timer: number | undefined;
/** Debounced: a burst of local writes (a sale = 1 + 2n rows) becomes one cycle. */
function schedule(delayMs: number) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delayMs);
}

export function startSync(intervalMs = 30_000): () => void {
  const { setOnline } = useConnectivity.getState();
  const onOnline = () => { setOnline(true); schedule(500); };
  const onOffline = () => setOnline(false);
  const onVisible = () => { if (document.visibilityState === 'visible') schedule(500); };
  const onOutboxWrite = () => { schedule(1500); };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  db.outbox.hook('creating', onOutboxWrite);
  const interval = window.setInterval(() => void syncNow(), intervalMs);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    db.outbox.hook('creating').unsubscribe(onOutboxWrite);
    window.clearInterval(interval);
    window.clearTimeout(timer);
  };
}
