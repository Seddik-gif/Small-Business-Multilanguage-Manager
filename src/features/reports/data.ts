import { db } from '@/db';
import type { ReportData } from './compute';

/** A period of whole local days, both ends included: "2026-11-01" … "2026-11-09". */
export interface Period {
  from: string;
  to: string;
}

const parseDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m: m - 1, d };
};

/** Local midnight of a YYYY-MM-DD day (the shop's day starts when the device's clock says so). */
export const dayStart = (day: string): Date => {
  const { y, m, d } = parseDay(day);
  return new Date(y, m, d, 0, 0, 0, 0);
};

export const toDayString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const today = (): string => toDayString(new Date());

export function addDays(day: string, n: number): string {
  const { y, m, d } = parseDay(day);
  return toDayString(new Date(y, m, d + n));
}

/** [start, end) as ISO strings for index range queries on created_at / payment_date. */
export function rangeIso({ from, to }: Period): [string, string] {
  return [dayStart(from).toISOString(), dayStart(addDays(to, 1)).toISOString()];
}

/**
 * Everything a report needs for a period, read from this device's database. Rows from other tills are
 * here once they have been synced; the report screens say so.
 */
export async function loadReport(period: Period): Promise<ReportData> {
  const [start, end] = rangeIso(period);
  const sales = await db.sales.where('created_at').between(start, end, true, false).filter((s) => !s.deleted).toArray();
  const saleIds = sales.map((s) => s.id);
  const items = saleIds.length ? await db.sale_items.where('sale_id').anyOf(saleIds).filter((i) => !i.deleted).toArray() : [];
  const payments = await db.debt_payments.where('payment_date').between(start, end, true, false).filter((p) => !p.deleted).toArray();
  const products = new Map((await db.products.toArray()).map((p) => [p.id, p]));
  return { sales, items, products, payments };
}
