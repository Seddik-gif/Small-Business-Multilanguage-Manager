import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { Product } from '@/types/models';

/**
 * A product needs reordering when it has a reorder level and stock is at or below it.
 * Products without a level never raise an alert: a shop that does not track stock for an item
 * would otherwise see it flagged forever. (An empty shelf still shows red on the till tile.)
 */
export const needsReorder = (p: Pick<Product, 'stock_quantity' | 'min_stock'>): boolean =>
  p.min_stock != null && p.stock_quantity <= p.min_stock;

/** How many active products need reordering: the badge on the Magazzino menu item. */
export function useReorderCount(): number {
  return useLiveQuery(() => db.products.filter((p) => !p.deleted && p.is_active === 1 && needsReorder(p)).count(), []) ?? 0;
}
