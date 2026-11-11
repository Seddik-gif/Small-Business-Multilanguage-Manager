import { db } from '@/db';
import { saveRecord, stamp } from '@/db/repo';
import { nowIso } from '@/lib/id';
import { round2, round3 } from '@/lib/money';
import { cartTotal, type CartLine } from '@/stores/cart';
import type { DebtPayment, PaymentMethod, Sale, SaleItem, StockMovement } from '@/types/models';

/**
 * Record a sale entirely offline, in one IndexedDB transaction:
 * sale + sale_items + one stock movement per line, each queued in the outbox (sale first,
 * so Phase 3 pushes the parent before its children). products.stock_quantity is updated as a
 * local cache only, not queued: the stock_movements ledger is the source of truth.
 *
 * Credit sale (payment_method 'credit'): needs a customer; the customer's debt is NOT updated here,
 * it is calculated from credit sales and payments (features/customers/debt.ts). An optional deposit
 * is recorded as a payment in the same transaction, so a crash cannot leave the sale without it.
 */
export async function createSale(
  lines: CartLine[],
  payment_method: PaymentMethod,
  opts: { customer_id?: string | null; staff_id?: string | null; discount_amount?: number; deposit?: number } = {},
): Promise<string> {
  if (lines.length === 0) throw new Error('Empty cart');
  const discount = round2(opts.discount_amount ?? 0);
  const total = round2(cartTotal(lines) - discount);
  if (discount < 0 || total < 0) throw new Error('The discount cannot be more than the basket'); // the database refuses it too
  const deposit = payment_method === 'credit' ? round2(opts.deposit ?? 0) : 0;
  if (payment_method === 'credit' && !opts.customer_id) throw new Error('A credit sale needs a customer');
  if (deposit < 0 || deposit > total) throw new Error('Deposit must be between 0 and the total');

  return db.transaction('rw', [db.sales, db.sale_items, db.stock_movements, db.products, db.debt_payments, db.outbox], async () => {
    const sale = await saveRecord(
      'sales',
      stamp<Sale>({
        customer_id: opts.customer_id ?? null,
        staff_id: opts.staff_id ?? null,
        total_amount: total,
        payment_method,
        discount_amount: discount,
      }),
    );

    for (const [i, line] of lines.entries()) {
      await saveRecord(
        'sale_items',
        stamp<SaleItem>({
          sale_id: sale.id,
          line_no: i + 1,
          product_id: line.product.id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          weight_kg: line.weight_kg,
          total_price: round2(line.quantity * line.unit_price),
          // Cost and IVA rate as they are at the moment of sale (reports rely on this). Read the product
          // now, not the cart's copy: the cart can be hours old.
          unit_cost: (await db.products.get(line.product.id))?.cost_price ?? line.product.cost_price ?? null,
          iva_rate: (await db.products.get(line.product.id))?.iva_rate ?? line.product.iva_rate,
        }),
      );
      await saveRecord(
        'stock_movements',
        stamp<StockMovement>({ product_id: line.product.id, delta: -line.quantity, reason: 'sale', ref_id: sale.id }),
      );
      await db.products
        .where('id')
        .equals(line.product.id)
        .modify((p) => {
          p.stock_quantity = round3(p.stock_quantity - line.quantity);
        });
    }

    if (deposit > 0) {
      await saveRecord(
        'debt_payments',
        stamp<DebtPayment>({
          customer_id: opts.customer_id!,
          amount: deposit,
          payment_date: nowIso(),
          notes: `Acconto #${sale.id.slice(0, 8).toUpperCase()}`,
        }),
      );
    }
    return sale.id;
  });
}
