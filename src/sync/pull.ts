import { db, SYNC_TABLES, type SyncTable } from '@/db';
import { supabase } from '@/lib/supabase';
import { classify, SyncAbort } from './errors';
import { recomputeStock } from './stock';
import { NUMERIC_FIELDS, PUSH_ORDER, TIMESTAMP_FIELDS } from './tables';

const PAGE = 500;
/**
 * Each pull re-reads the last minute before the stored cursor. Rows become visible to readers in
 * commit order, not synced_at order, so a row stamped just before the cursor can commit just after
 * we read. Re-applying a row is harmless (see applyRows), missing one is not.
 */
const OVERLAP_MS = 60_000;

type Row = Record<string, unknown> & { id: string; updated_at: string };

const cursorKey = (uid: string, table: string) => `pull:${uid}:${table}`;
const ms = (iso: string) => Date.parse(iso);

export interface PullResult {
  applied: number;
  /** Products whose server stock arrived or whose row changed: their stock cache needs a recompute. */
  stockProducts: Set<string>;
}

export async function pullAll(uid: string): Promise<PullResult> {
  const result: PullResult = { applied: 0, stockProducts: new Set() };
  for (const table of PUSH_ORDER) result.applied += await pullTable(uid, table, result);
  await pullStock(uid, result);
  await recomputeStock(result.stockProducts);
  return result;
}

/** Page through everything with synced_at after the cursor; returns the newest cursor seen. */
async function pageThrough(
  table: string,
  column: 'synced_at' | 'updated_at',
  cursor: string | null,
  onPage: (rows: Record<string, unknown>[]) => Promise<void>,
): Promise<string | null> {
  let since = cursor ? new Date(ms(cursor) - OVERLAP_MS).toISOString() : null;
  let op: 'gt' | 'gte' = 'gt';
  let newest = cursor;
  for (;;) {
    let q = supabase!.from(table).select('*').order(column, { ascending: true }).limit(PAGE);
    if (since) q = op === 'gt' ? q.gt(column, since) : q.gte(column, since);
    const { data, error, status } = await q;
    if (error) {
      const kind = classify(error, status);
      throw new SyncAbort(kind === 'network' || kind === 'auth' ? kind : 'server', `${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    await onPage(data);
    const last = data[data.length - 1][column] as string;
    if (!newest || ms(last) > ms(newest)) newest = last;
    if (data.length < PAGE) break;
    // gte re-reads the boundary row(s) so rows sharing the last timestamp are not skipped;
    // if a whole page shares one timestamp, fall back to gt to guarantee progress.
    op = last === since ? 'gt' : 'gte';
    since = last;
  }
  return newest;
}

async function pullTable(uid: string, table: SyncTable, result: PullResult): Promise<number> {
  const key = cursorKey(uid, table);
  const cursor = ((await db.kv.get(key))?.value as string | undefined) ?? null;
  let applied = 0;
  const newest = await pageThrough(table, 'synced_at', cursor, async (rows) => {
    applied += await applyRows(table, rows.map((r) => normalize(table, r)), result);
  });
  if (newest && newest !== cursor) await db.kv.put({ key, value: newest });
  return applied;
}

function normalize(table: SyncTable, raw: Record<string, unknown>): Row {
  const row = { ...raw };
  delete row.synced_at; // server bookkeeping, never stored locally
  for (const f of NUMERIC_FIELDS[table] ?? []) if (row[f] != null) row[f] = Number(row[f]);
  for (const f of TIMESTAMP_FIELDS) if (typeof row[f] === 'string') row[f] = new Date(row[f] as string).toISOString();
  return row as Row;
}

/**
 * Newest edit wins, per row:
 *  - no local copy                         → take the server row
 *  - local row has unsent changes (pending)→ server row only if it is NEWER; then the local edit is
 *                                            discarded and its outbox entry removed. Otherwise keep
 *                                            the local row: it is pushed next, and the server's own
 *                                            guard double-checks.
 *  - local row is in sync                  → take the server row unless the local copy is newer
 * Local-only fields survive (the spread keeps products.stock_quantity, a cache the server lacks).
 */
async function applyRows(table: SyncTable, rows: Row[], result: PullResult): Promise<number> {
  let applied = 0;
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    const tbl = db.table(table);
    for (const remote of rows) {
      const local = (await tbl.get(remote.id)) as (Row & { sync_status?: string }) | undefined;
      if (local) {
        const remoteNewer = ms(remote.updated_at) > ms(local.updated_at);
        const unsent = local.sync_status === 'pending' || local.sync_status === 'error';
        // Ledger rows are immutable on the server: the first one to arrive wins, not the newest. An unsent
        // local row is never replaced here; its push either matches the server's (fine) or is refused and
        // flagged to the owner, instead of quietly vanishing.
        if (table === 'stock_movements' && unsent) continue;
        if (unsent) {
          if (!remoteNewer) continue;
          await db.outbox.where('[table+row_id]').equals([table, remote.id]).delete();
        } else if (ms(local.updated_at) >= ms(remote.updated_at)) continue; // already have this version (overlap window)
      }
      // stock_quantity is a local cache the server does not have: start at 0, recomputeStock() fills it.
      const base = table === 'products' ? { stock_quantity: 0 } : {};
      await tbl.put({ ...base, ...local, ...remote, sync_status: 'synced' });
      if (table === 'products') result.stockProducts.add(remote.id);
      applied++;
    }
  });
  return applied;
}

/** product_stock is written only by the server, so it is pulled by its own updated_at. */
async function pullStock(uid: string, result: PullResult) {
  const key = cursorKey(uid, 'product_stock');
  const cursor = ((await db.kv.get(key))?.value as string | undefined) ?? null;
  const newest = await pageThrough('product_stock', 'updated_at', cursor, async (rows) => {
    await db.product_stock.bulkPut(
      rows.map((r) => ({
        product_id: r.product_id as string,
        stock_quantity: Number(r.stock_quantity),
        updated_at: new Date(r.updated_at as string).toISOString(),
      })),
    );
    for (const r of rows) result.stockProducts.add(r.product_id as string);
  });
  if (newest && newest !== cursor) await db.kv.put({ key, value: newest });
}

/** Forget pull cursors (full re-download on the next cycle). Rows already local are kept and re-merged. */
export async function resetPullCursors(uid: string): Promise<void> {
  const keys = [...SYNC_TABLES, 'product_stock'].map((t) => cursorKey(uid, t));
  await db.kv.bulkDelete(keys);
}
