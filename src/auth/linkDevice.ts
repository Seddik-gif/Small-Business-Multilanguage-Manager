import { db, SYNC_TABLES } from '@/db';
import { getDeviceId, getOwnerUid, setOwnerUid } from '@/lib/shop';

export class LinkedToOtherAccountError extends Error {
  constructor(public linkedUid: string) {
    super('This device is linked to another account');
    this.name = 'LinkedToOtherAccountError';
  }
}

export class ForeignRowsError extends Error {
  constructor(public table: string, public count: number) {
    super(`${count} rows in ${table} belong to another account`);
    this.name = 'ForeignRowsError';
  }
}

/**
 * Link this device's local data to the signed-in account. Must complete before any sync.
 *
 * - Rewrites user_id = <this device id> → uid on every synced table, in ONE transaction:
 *   either every row moves or none do.
 * - Refuses if the device is already linked to a different account, or if any row belongs to
 *   neither this device nor this account (the transaction rolls back, nothing changes).
 * - Outbox entries need no change: they hold only (table, row_id), and the push reads the row's
 *   current user_id at send time.
 * - updated_at / sync_status are deliberately untouched: this is not a user edit, and every
 *   affected row is still pending (rows owned by a device id can never have synced).
 * - Idempotent: safe to run on every sign-in and before every sync cycle; it is how a crash
 *   between the transaction and setOwnerUid() gets repaired.
 */
export async function linkDeviceToAccount(uid: string): Promise<{ migrated: number }> {
  const linked = getOwnerUid();
  if (linked && linked !== uid) throw new LinkedToOtherAccountError(linked);

  const deviceId = getDeviceId();
  let migrated = 0;
  await db.transaction('rw', SYNC_TABLES.map((t) => db.table(t)), async () => {
    for (const t of SYNC_TABLES) {
      migrated += await db.table(t).where('user_id').equals(deviceId).modify({ user_id: uid });
      const foreign = await db.table(t).where('user_id').notEqual(uid).count();
      if (foreign > 0) throw new ForeignRowsError(t, foreign);
    }
  });
  setOwnerUid(uid);
  return { migrated };
}

/** True when every local row is owned by uid, i.e. it is safe to push. */
export async function allRowsOwnedBy(uid: string): Promise<boolean> {
  for (const t of SYNC_TABLES) {
    if ((await db.table(t).where('user_id').notEqual(uid).count()) > 0) return false;
  }
  return true;
}
