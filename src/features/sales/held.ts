import { db } from '@/db';
import { newId, nowIso } from '@/lib/id';
import { round2 } from '@/lib/money';
import { productName } from '@/lib/product';
import { cartTotal, discountAmount, type CartLine, type Discount } from '@/stores/cart';

/**
 * Held ("parked") sales. They live in this device's IndexedDB only and are NOT synced: a basket parked
 * on one till is resumed on that till. They survive a reload, and nothing is reserved: stock is only
 * touched when the sale is finished.
 */
interface HeldPayload {
  lines: CartLine[];
  discount: Discount | null;
}

const time = (iso: string, lng: string) => new Date(iso).toLocaleTimeString(`${lng}-u-nu-latn`, { hour: '2-digit', minute: '2-digit' });

/** Park the basket under an automatic label ("14:32 · Pane +2") so a busy cashier never types anything. */
export async function holdCart(lines: CartLine[], discount: Discount | null, lng: string): Promise<string> {
  if (lines.length === 0) throw new Error('Nothing to hold');
  const created_at = nowIso();
  const first = productName(lines[0].product, lng);
  const label = `${time(created_at, lng)} · ${first}${lines.length > 1 ? ` +${lines.length - 1}` : ''}`;
  const id = newId();
  await db.held_sales.add({ id, label, payload: JSON.stringify({ lines, discount } satisfies HeldPayload), created_at });
  return id;
}

export interface HeldSummary {
  id: string;
  label: string;
  created_at: string;
  items: number;
  total: number;
}

export async function listHeld(): Promise<HeldSummary[]> {
  const rows = await db.held_sales.orderBy('created_at').toArray();
  return rows.map((r) => {
    const p = JSON.parse(r.payload) as HeldPayload;
    return {
      id: r.id,
      label: r.label,
      created_at: r.created_at,
      items: p.lines.length,
      total: round2(cartTotal(p.lines) - discountAmount(p.lines, p.discount)),
    };
  });
}

export interface Resumed {
  lines: CartLine[];
  discount: Discount | null;
  /** Lines dropped because the product has since been deleted or deactivated. */
  dropped: number;
  /** Lines whose price changed while the sale was parked: they now carry the current price. */
  repriced: number;
}

/**
 * Take a held sale back out. Prices are refreshed from the catalogue (a parked basket can be hours
 * old); products that no longer exist are dropped. The caller puts the result in the cart.
 */
export async function loadHeld(id: string): Promise<Resumed> {
  const row = await db.held_sales.get(id);
  if (!row) throw new Error('Held sale not found');
  const payload = JSON.parse(row.payload) as HeldPayload;
  let dropped = 0;
  let repriced = 0;
  const lines: CartLine[] = [];
  for (const line of payload.lines) {
    const product = await db.products.get(line.product.id);
    if (!product || product.deleted || product.is_active !== 1) {
      dropped++;
      continue;
    }
    const unit_price = line.weight_kg !== null ? product.price_per_kg ?? line.unit_price : product.price;
    if (unit_price !== line.unit_price) repriced++;
    lines.push({ ...line, product, unit_price });
  }
  return { lines, discount: payload.discount, dropped, repriced };
}

export const discardHeld = (id: string): Promise<void> => db.held_sales.delete(id);
