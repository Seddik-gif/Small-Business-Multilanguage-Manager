import { db } from '@/db';
import { saveRecord, stamp } from '@/db/repo';
import { round3 } from '@/lib/money';
import type { StockMovement, WasteReason } from '@/types/models';

export const WASTE_REASONS: WasteReason[] = ['expired', 'spoiled', 'damaged', 'theft', 'other'];

/**
 * Record stock thrown away or lost. It is a ledger entry (reason 'waste', negative), never an edit of
 * the stock number, so it adds up correctly across tills. To correct a mistake, record an adjustment
 * (edit the stock in the product): ledger entries are never changed or deleted.
 */
export async function createWaste(input: { productId: string; quantity: number; reason: WasteReason; note?: string }): Promise<void> {
  const quantity = round3(input.quantity);
  if (!(quantity > 0)) throw new Error('Quantity must be more than zero');
  await db.transaction('rw', [db.stock_movements, db.products, db.outbox], async () => {
    await saveRecord(
      'stock_movements',
      stamp<StockMovement>({
        product_id: input.productId,
        delta: -quantity,
        reason: 'waste',
        ref_id: null,
        waste_reason: input.reason,
        note: input.note?.trim() || null,
      }),
    );
    await db.products.where('id').equals(input.productId).modify((p) => {
      p.stock_quantity = round3(p.stock_quantity - quantity); // local display cache
    });
  });
}
