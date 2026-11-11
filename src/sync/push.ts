import { db, type OutboxEntry, type SyncTable } from '@/db';
import { supabase } from '@/lib/supabase';
import { classify, type FailureKind } from './errors';
import { toServerRow } from './serialize';
import { recomputeStock } from './stock';
import { MAX_ATTEMPTS, PUSH_ORDER } from './tables';

const BATCH = 100;

export interface PushResult {
  pushed: number;
  /** Rows the server refused (or whose parent did): still pending locally. */
  failed: number;
  /** Set when the cycle must stop; nothing was lost, everything stays pending. */
  abort: 'network' | 'auth' | 'server' | null;
  lastError?: string;
}

type Item = { entry: OutboxEntry; row: Record<string, unknown> & { id: string; updated_at: string } };

/**
 * Push the outbox, one request per table (in foreign-key order), 100 rows at a time.
 * A rejected batch is retried row by row so one bad row cannot block the rest.
 */
export async function pushOutbox(): Promise<PushResult> {
  const result: PushResult = { pushed: 0, failed: 0, abort: null };
  if (!supabase) return result;

  const entries = (await db.outbox.toArray()).filter((e) => e.attempts < MAX_ATTEMPTS);
  const byTable = new Map<SyncTable, OutboxEntry[]>();
  for (const e of entries) byTable.set(e.table, [...(byTable.get(e.table) ?? []), e]);

  for (const table of PUSH_ORDER) {
    const list = (byTable.get(table) ?? []).sort((a, b) => a.seq! - b.seq!);
    for (let i = 0; i < list.length; i += BATCH) {
      await pushChunk(table, list.slice(i, i + BATCH), result);
      if (result.abort) return result;
    }
  }
  return result;
}

async function pushChunk(table: SyncTable, entries: OutboxEntry[], result: PushResult) {
  const items: Item[] = [];
  for (const entry of entries) {
    const row = (await db.table(table).get(entry.row_id)) as Item['row'] | undefined;
    if (!row) await db.outbox.delete(entry.seq!); // row vanished locally: nothing to send
    else items.push({ entry, row });
  }
  if (items.length === 0) return;

  const all = await upsert(table, items.map((x) => x.row));
  if (!all) {
    await markSynced(table, items);
    result.pushed += items.length;
    return;
  }
  if (stops(all.kind)) return abort(result, all);
  if (items.length === 1) return fail(table, items[0], all, result);

  // Isolate the culprit: one by one.
  for (const item of items) {
    const err = await upsert(table, [item.row]);
    if (!err) {
      await markSynced(table, [item]);
      result.pushed++;
    } else if (stops(err.kind)) return abort(result, err);
    else await fail(table, item, err, result);
  }
}

interface Failure {
  kind: FailureKind;
  message: string;
}

/** null = success. `defaultToNull: false` makes columns a row omits fall back to the column default. */
async function upsert(table: SyncTable, rows: Item['row'][]): Promise<Failure | null> {
  const { error, status } = await supabase!.from(table).upsert(
    rows.map((r) => toServerRow(table, r)),
    { defaultToNull: false },
  );
  return error ? { kind: classify(error, status), message: error.message } : null;
}

const stops = (k: FailureKind) => k === 'network' || k === 'auth' || k === 'transient';

function abort(result: PushResult, f: Failure) {
  result.abort = f.kind === 'transient' ? 'server' : (f.kind as 'network' | 'auth');
  result.lastError = f.message;
}

/**
 * Mark rows synced and drop their outbox entries, unless the row was edited while the request was in
 * flight (its updated_at moved). saveRecord() does not add a second outbox entry for a row that already
 * has one, so keeping the existing entry is what makes the newer edit go out next cycle.
 */
async function markSynced(table: SyncTable, items: Item[]) {
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    for (const { entry, row } of items) {
      const current = (await db.table(table).get(row.id)) as { updated_at: string } | undefined;
      if (!current) await db.outbox.delete(entry.seq!);
      else if (current.updated_at === row.updated_at) {
        await db.table(table).update(row.id, { sync_status: 'synced' });
        await db.outbox.delete(entry.seq!);
      }
    }
  });
}

async function fail(table: SyncTable, { entry, row }: Item, f: Failure, result: PushResult) {
  result.failed++;
  result.lastError = f.message;
  // A parent failure is not this row's fault: it retries every cycle without using up attempts.
  // A ledger row (stock_movements) the server refuses outright is final: the ledger is append-only, so
  // retrying cannot succeed, and until it is flagged the till would keep counting it in its stock.
  const attempts =
    f.kind === 'parent' ? entry.attempts : table === 'stock_movements' ? MAX_ATTEMPTS : entry.attempts + 1;
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.outbox.update(entry.seq!, { attempts, last_error: `${table}: ${f.message}` });
    if (attempts >= MAX_ATTEMPTS) await db.table(table).update(row.id, { sync_status: 'error' });
  });
  // A stock movement the server refused for good no longer counts towards what the till shows.
  if (table === 'stock_movements' && attempts >= MAX_ATTEMPTS) await recomputeStock([row.product_id as string]);
}

/** Owner tapped "Retry": give flagged rows a fresh set of attempts. */
export async function retryFailed(): Promise<number> {
  const flagged = await db.outbox.filter((e) => e.attempts >= MAX_ATTEMPTS).toArray();
  await db.transaction('rw', [db.outbox, ...PUSH_ORDER.map((t) => db.table(t))], async () => {
    for (const e of flagged) {
      await db.outbox.update(e.seq!, { attempts: 0, last_error: undefined });
      await db.table(e.table).update(e.row_id, { sync_status: 'pending' });
    }
  });
  // Retried stock movements count again until they are sent or refused again.
  const movements = await db.stock_movements.bulkGet(flagged.filter((e) => e.table === 'stock_movements').map((e) => e.row_id));
  await recomputeStock(movements.filter((m) => !!m).map((m) => m!.product_id));
  return flagged.length;
}
