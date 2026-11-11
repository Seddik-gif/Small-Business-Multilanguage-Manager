import { db, type SyncTable } from '.';
import { getShopId } from '@/lib/shop';
import { newId, nowIso } from '@/lib/id';
import type { SyncMeta } from '@/types/models';

type Fields<T extends SyncMeta> = Omit<T, keyof SyncMeta> & { id?: string };

/**
 * Fill in sync metadata for a new row, or bump it on an existing one.
 * Every local write sets updated_at (last-write-wins) and marks the row pending.
 */
export function stamp<T extends SyncMeta>(fields: Fields<T>, prev?: T): T {
  const now = nowIso();
  return {
    ...prev,
    ...fields,
    id: fields.id ?? prev?.id ?? newId(),
    user_id: prev?.user_id ?? getShopId(),
    created_at: prev?.created_at ?? now,
    updated_at: now,
    sync_status: 'pending',
    deleted: prev?.deleted ?? 0,
  } as T;
}

/**
 * Queue a row for Phase 3 sync. One outbox entry per row is enough: the sync engine reads
 * the row's current state when it pushes. seq order is preserved so parents (sales) are
 * pushed before children (sale_items).
 */
async function enqueue(table: SyncTable, row_id: string) {
  const existing = await db.outbox.where('[table+row_id]').equals([table, row_id]).first();
  if (existing) {
    // The user just edited a row the server had been refusing: that is a fix, give it a fresh start.
    if (existing.attempts > 0) await db.outbox.update(existing.seq!, { attempts: 0, last_error: undefined });
    return;
  }
  await db.outbox.add({ table, row_id, op: 'upsert', queued_at: nowIso(), attempts: 0 });
}

/** Write a row to IndexedDB and queue it, atomically. Safe to call inside a larger transaction. */
export async function saveRecord<T extends SyncMeta>(table: SyncTable, row: T): Promise<T> {
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).put(row);
    await enqueue(table, row.id);
  });
  return row;
}

/** Soft delete: the row stays (deleted = 1) so the deletion itself can sync. */
export async function softDelete(table: SyncTable, id: string): Promise<void> {
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).update(id, { deleted: 1, updated_at: nowIso(), sync_status: 'pending' });
    await enqueue(table, id);
  });
}
