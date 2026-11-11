import type { SyncTable } from '@/db';

/**
 * Push order = foreign-key order: parents before children. Rows of one table never reference each
 * other, so a whole table can go as one request. (Plain outbox seq order would also be parent-first
 * for new data, but not when an old row is edited to point at a newer parent, e.g. a product moved
 * into a category created afterwards.)
 */
export const PUSH_ORDER: readonly SyncTable[] = [
  'categories',
  'staff',
  'customers',
  'suppliers',
  'products',
  'purchase_orders',
  'sales',
  'sale_items',
  'purchase_order_items',
  'debt_payments',
  'stock_movements',
];

/** PostgREST may return numeric columns as strings depending on version/settings: coerce on pull. */
export const NUMERIC_FIELDS: Partial<Record<SyncTable, readonly string[]>> = {
  products: ['price', 'price_per_kg', 'cost_price', 'min_stock'],
  sales: ['total_amount', 'discount_amount'],
  sale_items: ['quantity', 'unit_price', 'weight_kg', 'total_price', 'unit_cost'],
  debt_payments: ['amount'],
  purchase_orders: ['total_amount'],
  purchase_order_items: ['quantity', 'unit_cost'],
  stock_movements: ['delta'],
};

/** Server timestamps look like 2026-11-08T21:41:02.464721+00:00; locally everything is toISOString(). */
export const TIMESTAMP_FIELDS = ['created_at', 'updated_at', 'payment_date', 'received_at'] as const;

/** Rows that failed this many times are flagged and skipped until the owner taps "Retry". */
export const MAX_ATTEMPTS = 5;
