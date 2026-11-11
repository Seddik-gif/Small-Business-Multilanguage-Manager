import { db } from '@/db';
import { round3 } from '@/lib/money';

/**
 * products.stock_quantity is a display cache: the server's stock for the product (pulled from
 * product_stock, derived there from the ledger) plus this till's movements the server has not
 * received yet. Never sent to the server.
 *
 * Runs in ONE transaction with the reads it depends on, so a sale being rung up at the same moment
 * (createSale also writes products + stock_movements in one transaction) is either fully counted
 * or fully applied after.
 */
export async function recomputeStock(productIds: Iterable<string>): Promise<number> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return 0;
  let updated = 0;
  await db.transaction('rw', [db.products, db.product_stock, db.stock_movements], async () => {
    for (const id of ids) {
      const server = await db.product_stock.get(id);
      if (!server) continue; // not pulled yet: keep the local cache as it is
      const unsent = await db.stock_movements
        .where('product_id')
        .equals(id)
        // Only movements still waiting to go out. One the server refused for good ('error') is not
        // counted: the server's figure is the truth, and the rejection is shown to the owner.
        .filter((m) => m.sync_status === 'pending')
        .toArray();
      const total = round3(server.stock_quantity + unsent.reduce((sum, m) => sum + m.delta, 0));
      const n = await db.products.where('id').equals(id).modify((p) => {
        p.stock_quantity = total;
      });
      updated += n;
    }
  });
  return updated;
}
