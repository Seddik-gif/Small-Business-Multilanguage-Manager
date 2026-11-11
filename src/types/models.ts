/**
 * Local entity types mirroring the Supabase schema in the spec.
 * Every syncable row carries: string UUID id (generated on device, so rows can be created offline),
 * updated_at (ISO, for last-write-wins), and sync_status (local bookkeeping, never sent to the server).
 */
export type SyncStatus = 'pending' | 'synced' | 'error';
export type PaymentMethod = 'cash' | 'card' | 'credit';
export type IvaRate = 4 | 10 | 22;
export type Role = 'owner' | 'cashier';

export interface SyncMeta {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted?: 0 | 1; // soft delete so deletions can sync
}

export interface Product extends SyncMeta {
  barcode: string | null;
  image_url: string | null;
  name_it: string;
  name_en: string | null;
  name_ar: string | null;
  name_bn: string | null;
  name_zh: string | null;
  price: number;
  price_per_kg: number | null;
  cost_price: number | null;
  stock_quantity: number;
  /** Reorder level (not in spec): at or below it the product is flagged low. null/undefined = no alert. */
  min_stock?: number | null;
  category_id: string | null;
  iva_rate: IvaRate;
  is_active: 0 | 1;
}

export interface Category extends SyncMeta {
  name: string;
  color: string;
  icon: string | null;
}

export interface Customer extends SyncMeta {
  name: string;
  phone: string | null;
  /** Language for messages TO this customer (WhatsApp reminders); null = the app's current language. */
  language_preference: string | null;
  notes: string | null;
  // No stored debt: it is calculated from credit sales and payments (features/customers/debt.ts).
}

export interface Sale extends SyncMeta {
  customer_id: string | null;
  staff_id: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  discount_amount: number;
}

export interface SaleItem extends SyncMeta {
  sale_id: string;
  line_no: number; // not in spec: keeps receipt lines in the order they were rung up
  product_id: string;
  quantity: number;
  unit_price: number;
  weight_kg: number | null;
  total_price: number;
  /** Cost per unit (per kg for weighed items) when sold, for profit reports. null = unknown then. */
  unit_cost?: number | null;
  /** IVA rate when sold (null = unknown then; reports fall back to the product's current rate). */
  iva_rate?: IvaRate | null;
}

export interface DebtPayment extends SyncMeta {
  customer_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
}

export interface Supplier extends SyncMeta {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';
export interface PurchaseOrder extends SyncMeta {
  supplier_id: string;
  status: PurchaseOrderStatus;
  total_amount: number;
  received_at: string | null;
}

/** Not in spec: needed to know what a PO contains so receiving can increase stock. */
export interface PurchaseOrderItem extends SyncMeta {
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
}

/** Not in spec: stock ledger, required by waste/loss tracking and safe multi-device stock. */
export interface StockMovement extends SyncMeta {
  product_id: string;
  delta: number; // + received, - sold / wasted
  reason: 'sale' | 'purchase' | 'waste' | 'adjustment';
  ref_id: string | null;
  /** Waste only: why the stock was thrown away. */
  waste_reason?: WasteReason | null;
  note?: string | null;
}

export type WasteReason = 'expired' | 'spoiled' | 'damaged' | 'theft' | 'other';

/** Not in spec: staff members with PIN for quick switching (Owner/Cashier). */
export interface Staff extends SyncMeta {
  name: string;
  role: Role;
  pin_hash: string;
  /** Language this person uses (it/en/ar/bn/zh); applied when they unlock. null = keep the till's language. */
  language_preference?: string | null;
}
