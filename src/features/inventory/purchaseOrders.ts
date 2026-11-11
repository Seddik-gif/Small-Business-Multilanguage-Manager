import { db } from '@/db';
import { saveRecord, softDelete, stamp } from '@/db/repo';
import { deterministicId, nowIso } from '@/lib/id';
import { round2, round3 } from '@/lib/money';
import type { Product, PurchaseOrder, PurchaseOrderItem, StockMovement } from '@/types/models';

export interface OrderLine {
  /** Present when the line already exists (editing a draft). */
  itemId?: string;
  productId: string;
  quantity: number;
  unitCost: number;
}

export const lineSum = (lines: { quantity: number; unitCost: number }[]): number =>
  round2(lines.reduce((s, l) => s + Math.round(l.quantity * l.unitCost * 100) / 100, 0));

/** Create or update a purchase order. Only a draft can be edited; "ordered" is one-way. */
export async function savePurchaseOrder(input: {
  orderId?: string | null;
  supplierId: string;
  status: 'draft' | 'ordered';
  lines: OrderLine[];
}): Promise<string> {
  if (input.lines.length === 0) throw new Error('An order needs at least one line');
  return db.transaction('rw', [db.purchase_orders, db.purchase_order_items, db.outbox], async () => {
    const prev = input.orderId ? await db.purchase_orders.get(input.orderId) : undefined;
    if (prev && prev.status !== 'draft') throw new Error('Only a draft order can be edited');
    const po = await saveRecord(
      'purchase_orders',
      stamp<PurchaseOrder>({ supplier_id: input.supplierId, status: input.status, total_amount: lineSum(input.lines), received_at: null }, prev),
    );
    const existing = await db.purchase_order_items.where('purchase_order_id').equals(po.id).filter((i) => !i.deleted).toArray();
    const kept = new Set(input.lines.map((l) => l.itemId).filter(Boolean));
    for (const item of existing) if (!kept.has(item.id)) await softDelete('purchase_order_items', item.id);
    for (const l of input.lines) {
      const prevItem = l.itemId ? existing.find((i) => i.id === l.itemId) : undefined;
      await saveRecord(
        'purchase_order_items',
        stamp<PurchaseOrderItem>({ purchase_order_id: po.id, product_id: l.productId, quantity: l.quantity, unit_cost: l.unitCost }, prevItem),
      );
    }
    return po.id;
  });
}

export async function cancelPurchaseOrder(orderId: string): Promise<void> {
  await db.transaction('rw', [db.purchase_orders, db.outbox], async () => {
    const po = await db.purchase_orders.get(orderId);
    if (!po || po.status === 'received') throw new Error('This order cannot be cancelled');
    await saveRecord('purchase_orders', stamp<PurchaseOrder>({ supplier_id: po.supplier_id, status: 'cancelled', total_amount: po.total_amount, received_at: null }, po));
  });
}

/**
 * Receive a delivery: stock goes up, the order is closed.
 *
 * One stock movement per line, with an id DERIVED from the order line. If two tills receive the same
 * delivery while offline they create the very same row, and the server keeps one: stock goes up once,
 * not twice. (If they typed different quantities the server refuses the second one, which shows up as
 * a rejected change for the owner.)
 *
 * `received` maps order-line id to the quantity that actually arrived; 0 drops the line.
 * With `updateCost`, each product's cost price becomes the unit cost on the order, which is what
 * the margin reports use.
 */
export async function receivePurchaseOrder(orderId: string, received: Record<string, number>, updateCost: boolean): Promise<void> {
  const items = await db.purchase_order_items.where('purchase_order_id').equals(orderId).filter((i) => !i.deleted).toArray();
  // Derive the ids BEFORE the transaction: awaiting a non-Dexie promise inside one would end it.
  const movementIds = new Map<string, string>();
  for (const item of items) movementIds.set(item.id, await deterministicId(`po-receipt:${item.id}`));

  await db.transaction('rw', [db.purchase_orders, db.purchase_order_items, db.stock_movements, db.products, db.outbox], async () => {
    const po = await db.purchase_orders.get(orderId);
    if (!po) throw new Error('Order not found');
    if (po.status === 'received') return; // already done on this till
    if (po.status !== 'ordered') throw new Error('Only an ordered purchase order can be received');

    const arrived: { quantity: number; unitCost: number }[] = [];
    for (const item of items) {
      const quantity = round3(received[item.id] ?? 0);
      if (quantity <= 0) {
        await softDelete('purchase_order_items', item.id);
        continue;
      }
      arrived.push({ quantity, unitCost: item.unit_cost });
      await saveRecord(
        'purchase_order_items',
        stamp<PurchaseOrderItem>({ purchase_order_id: item.purchase_order_id, product_id: item.product_id, quantity, unit_cost: item.unit_cost }, item),
      );
      await saveRecord(
        'stock_movements',
        stamp<StockMovement>({
          id: movementIds.get(item.id)!,
          product_id: item.product_id,
          delta: quantity,
          reason: 'purchase',
          ref_id: po.id,
          waste_reason: null,
          note: null,
        }),
      );
      const product = await db.products.get(item.product_id);
      if (product) {
        const stock_quantity = round3(product.stock_quantity + quantity); // local display cache
        if (updateCost) await saveRecord('products', stamp<Product>({ ...product, stock_quantity, cost_price: item.unit_cost }, product));
        else await db.products.update(product.id, { stock_quantity });
      }
    }
    await saveRecord(
      'purchase_orders',
      stamp<PurchaseOrder>({ supplier_id: po.supplier_id, status: 'received', total_amount: lineSum(arrived), received_at: nowIso() }, po),
    );
  });
}
