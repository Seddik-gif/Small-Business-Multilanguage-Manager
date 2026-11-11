import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/types/models';
import { newId } from '@/lib/id';
import { round2, round3 } from '@/lib/money';

/**
 * A cart line. For weighed products quantity === weight_kg and unit_price is the price per kg,
 * so total = quantity × unit_price for every line and stock moves by -quantity (kg or pieces).
 */
export interface CartLine {
  key: string;
  product: Product; // snapshot: names, image, IVA rate at time of sale
  quantity: number;
  unit_price: number;
  weight_kg: number | null;
}

export const lineTotal = (l: CartLine): number => round2(l.quantity * l.unit_price);
/** Sum of the lines, before any discount. */
export const cartTotal = (lines: CartLine[]): number => round2(lines.reduce((s, l) => s + lineTotal(l), 0));

/** A discount on the whole basket: a percentage of it, or a fixed amount in euro. */
export interface Discount {
  type: 'percent' | 'fixed';
  value: number;
}

/**
 * The discount in euro for this basket. A percentage follows the basket as items are added or removed;
 * a fixed amount is capped at the basket value, so a total can never go negative.
 */
export function discountAmount(lines: CartLine[], discount: Discount | null | undefined): number {
  if (!discount || !(discount.value > 0)) return 0;
  const subtotal = cartTotal(lines);
  const raw = discount.type === 'percent' ? round2((subtotal * Math.min(discount.value, 100)) / 100) : round2(discount.value);
  return Math.min(raw, subtotal);
}

/** What the customer pays: the lines minus the discount. */
export const netTotal = (lines: CartLine[], discount: Discount | null | undefined): number =>
  round2(cartTotal(lines) - discountAmount(lines, discount));

interface CartState {
  lines: CartLine[];
  discount: Discount | null;
  /** Unit products stack on one line; pass kg for a weighed product (always a new line). */
  add: (p: Product, kg?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  setDiscount: (d: Discount | null) => void;
  /** Replace the whole basket (resuming a held sale). */
  restore: (lines: CartLine[], discount: Discount | null) => void;
  clear: () => void;
}

// Persisted so a reload or crash mid-sale doesn't lose the customer's basket (or its discount).
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      discount: null,
      add: (p, kg) =>
        set((s) => {
          if (kg !== undefined) {
            const w = round3(kg);
            return { lines: [...s.lines, { key: newId(), product: p, quantity: w, unit_price: p.price_per_kg ?? 0, weight_kg: w }] };
          }
          const existing = s.lines.find((l) => l.product.id === p.id && l.weight_kg === null);
          if (existing) {
            return { lines: s.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l)) };
          }
          return { lines: [...s.lines, { key: newId(), product: p, quantity: 1, unit_price: p.price, weight_kg: null }] };
        }),
      setQuantity: (key, quantity) =>
        set((s) => ({
          lines:
            quantity <= 0
              ? s.lines.filter((l) => l.key !== key)
              : s.lines.map((l) =>
                  l.key === key ? { ...l, quantity: round3(quantity), weight_kg: l.weight_kg !== null ? round3(quantity) : null } : l,
                ),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      setDiscount: (discount) => set({ discount }),
      restore: (lines, discount) => set({ lines, discount }),
      // An empty basket has no discount: the next customer must not inherit it.
      clear: () => set({ lines: [], discount: null }),
    }),
    { name: 'pos.cart' },
  ),
);
