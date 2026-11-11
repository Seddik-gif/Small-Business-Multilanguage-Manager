import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { round2 } from '@/lib/money';
import type { DebtPayment, Sale } from '@/types/models';

/**
 * Debt = credit sales − payments, calculated from rows, never stored. Every sale and every payment
 * is its own row that syncs independently, so two tills recording payments for the same customer
 * offline both count once the tills have synced (a stored total would keep only the last write).
 * The server computes the same figure in the customer_balances view.
 * Deleted rows (deleted = 1) are ignored.
 */
const isCreditSale = (s: Sale) => !s.deleted && s.payment_method === 'credit' && !!s.customer_id;

/** Balance for every customer with any credit activity. Customers not in the map owe 0. */
export async function loadBalances(): Promise<Map<string, number>> {
  const sales = await db.sales.where('payment_method').equals('credit').filter(isCreditSale).toArray();
  const payments = await db.debt_payments.filter((p) => !p.deleted).toArray();
  const cents = new Map<string, number>();
  const add = (id: string, amount: number) => cents.set(id, (cents.get(id) ?? 0) + Math.round(amount * 100));
  for (const s of sales) add(s.customer_id!, s.total_amount);
  for (const p of payments) add(p.customer_id, -p.amount);
  return new Map([...cents].map(([id, c]) => [id, round2(c / 100)]));
}

/** Live balances for the customers list and the till. undefined while loading. */
export function useBalances(): Map<string, number> | undefined {
  return useLiveQuery(loadBalances, []);
}

export type LedgerEntry =
  | { kind: 'sale'; id: string; date: string; amount: number; balance: number; sale: Sale }
  | { kind: 'payment'; id: string; date: string; amount: number; balance: number; payment: DebtPayment };

/** One customer's movements, oldest first, with the running balance after each. */
export async function loadLedger(customerId: string): Promise<{ entries: LedgerEntry[]; balance: number }> {
  const sales = await db.sales.where('customer_id').equals(customerId).filter(isCreditSale).toArray();
  const payments = await db.debt_payments.where('customer_id').equals(customerId).filter((p) => !p.deleted).toArray();
  const raw = [
    ...sales.map((sale) => ({ kind: 'sale' as const, id: sale.id, date: sale.created_at, cents: Math.round(sale.total_amount * 100), sale })),
    ...payments.map((payment) => ({ kind: 'payment' as const, id: payment.id, date: payment.payment_date, cents: -Math.round(payment.amount * 100), payment })),
  ].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  let running = 0;
  const entries = raw.map((e) => {
    running += e.cents;
    const base = { id: e.id, date: e.date, amount: round2(e.cents / 100), balance: round2(running / 100) };
    return e.kind === 'sale' ? { ...base, kind: 'sale' as const, sale: e.sale } : { ...base, kind: 'payment' as const, payment: e.payment };
  });
  return { entries, balance: round2(running / 100) };
}
