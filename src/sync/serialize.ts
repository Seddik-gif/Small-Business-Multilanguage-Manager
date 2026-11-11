import type { SyncTable } from '@/db';

/**
 * Wire contract for Phase 3 pushes: the exact shape a local row is sent to Supabase in.
 * Local-only bookkeeping never leaves the device, and products.stock_quantity is a local cache
 * of the server's product_stock (that column no longer exists on the server, see migration 0003).
 */
const LOCAL_ONLY: Record<string, readonly string[]> = {
  '*': ['sync_status'],
  products: ['stock_quantity'],
};

export function toServerRow(table: SyncTable, row: Record<string, unknown>): Record<string, unknown> {
  const drop = new Set([...LOCAL_ONLY['*'], ...(LOCAL_ONLY[table] ?? [])]);
  return Object.fromEntries(Object.entries(row).filter(([k]) => !drop.has(k)));
}
