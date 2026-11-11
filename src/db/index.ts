import Dexie, { type EntityTable } from 'dexie';
import type {
  Category, Customer, DebtPayment, Product, PurchaseOrder, PurchaseOrderItem,
  Sale, SaleItem, Staff, StockMovement, Supplier,
} from '@/types/models';

/** Parked (held) carts are device-local only, never synced. */
export interface HeldSale {
  id: string;
  label: string;
  payload: string; // JSON of cart state
  created_at: string;
}

export const SYNC_TABLES = [
  'products', 'categories', 'customers', 'sales', 'sale_items', 'debt_payments',
  'suppliers', 'purchase_orders', 'purchase_order_items', 'stock_movements', 'staff',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Outbox of local writes waiting to be pushed to Supabase. */
export interface OutboxEntry {
  seq?: number;
  table: SyncTable;
  row_id: string;
  op: 'upsert' | 'delete';
  queued_at: string;
  /** Failed pushes that the server rejected for good (not network trouble). Reaches MAX_ATTEMPTS => flagged. */
  attempts: number;
  last_error?: string;
}

export interface KV { key: string; value: unknown }

/** Product photo stored as a Blob on the device; Phase 3 uploads pending ones to Supabase Storage
 * and writes the resulting URL into products.image_url. Keyed by product id. */
export interface ProductImage {
  id: string;
  blob: Blob;
  updated_at: string;
  sync_status: 'pending' | 'synced';
  /** Storage object path this blob corresponds to (set once uploaded or downloaded). Compared with
   * products.image_url to know when another till replaced the photo. */
  path?: string;
}

/** Server-calculated stock per product (read-only cache of Supabase's product_stock). The product's
 * displayed stock_quantity = this + the deltas of local movements not yet pushed. */
export interface ServerStock {
  product_id: string;
  stock_quantity: number;
  updated_at: string;
}

export class PosDB extends Dexie {
  products!: EntityTable<Product, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  sales!: EntityTable<Sale, 'id'>;
  sale_items!: EntityTable<SaleItem, 'id'>;
  debt_payments!: EntityTable<DebtPayment, 'id'>;
  suppliers!: EntityTable<Supplier, 'id'>;
  purchase_orders!: EntityTable<PurchaseOrder, 'id'>;
  purchase_order_items!: EntityTable<PurchaseOrderItem, 'id'>;
  stock_movements!: EntityTable<StockMovement, 'id'>;
  staff!: EntityTable<Staff, 'id'>;
  held_sales!: EntityTable<HeldSale, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;
  kv!: EntityTable<KV, 'key'>;
  product_images!: EntityTable<ProductImage, 'id'>;
  product_stock!: EntityTable<ServerStock, 'product_id'>;

  constructor() {
    super('multilingual-pos');
    // Only indexed fields are listed; other columns are stored but not indexed.
    // barcode is not unique-indexed: many products (loose meat, bread) have none.
    this.version(1).stores({
      products: 'id, user_id, barcode, category_id, is_active, updated_at, sync_status, name_it, name_en, name_ar, name_bn, name_zh',
      categories: 'id, user_id, updated_at, sync_status',
      customers: 'id, user_id, phone, name, updated_at, sync_status',
      sales: 'id, user_id, customer_id, payment_method, created_at, updated_at, sync_status',
      sale_items: 'id, sale_id, product_id, updated_at, sync_status',
      debt_payments: 'id, customer_id, payment_date, updated_at, sync_status',
      suppliers: 'id, user_id, updated_at, sync_status',
      purchase_orders: 'id, user_id, supplier_id, status, updated_at, sync_status',
      purchase_order_items: 'id, purchase_order_id, product_id, updated_at, sync_status',
      stock_movements: 'id, product_id, reason, created_at, updated_at, sync_status',
      staff: 'id, user_id, updated_at, sync_status',
      held_sales: 'id, created_at',
      outbox: '++seq, table, row_id',
      kv: 'key',
    });
    // v2: photos stored locally; compound index lets the outbox keep one entry per row.
    this.version(2).stores({
      outbox: '++seq, table, row_id, [table+row_id]',
      product_images: 'id, sync_status',
    });
    // v3: user_id on every synced table, so the device→account link can find rows to rewrite.
    this.version(3).stores({
      sale_items: 'id, user_id, sale_id, product_id, updated_at, sync_status',
      debt_payments: 'id, user_id, customer_id, payment_date, updated_at, sync_status',
      purchase_order_items: 'id, user_id, purchase_order_id, product_id, updated_at, sync_status',
      stock_movements: 'id, user_id, product_id, reason, created_at, updated_at, sync_status',
    });
    // v4: server stock cache; the stock recompute reads unsent movements per product.
    this.version(4).stores({
      product_stock: 'product_id',
      stock_movements: 'id, user_id, product_id, reason, created_at, updated_at, sync_status, [product_id+sync_status]',
    });
  }
}

export const db = new PosDB();
