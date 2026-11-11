import { round2 } from '@/lib/money';
import { isWeighed } from '@/lib/product';
import type { Customer, Product } from '@/types/models';
import { lineFigures, localDay, type DayRow, type ProductStat, type ReportData } from './compute';

/**
 *  it   – what an Italian Excel opens correctly: ";" between columns, "," as the decimal mark.
 *  intl – "," between columns, "." as the decimal mark (Google Sheets, English-language Excel, code).
 */
export type CsvFormat = 'it' | 'intl';
type Cell = string | number | null | undefined;

function cell(v: Cell, format: CsvFormat): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return format === 'it' ? String(v).replace('.', ',') : String(v);
  // Spreadsheet formula injection: a product or customer name like "=HYPERLINK(...)" would run when the
  // file is opened. Prefix anything that starts like a formula so it is read as plain text.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  const sep = format === 'it' ? ';' : ',';
  return /["\r\n]/.test(safe) || safe.includes(sep) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Cell[][], format: CsvFormat): string {
  const sep = format === 'it' ? ';' : ',';
  return rows.map((r) => r.map((v) => cell(v, format)).join(sep)).join('\r\n') + '\r\n';
}

/** Saves a CSV. The BOM makes Excel read the file as UTF-8, so accents, Arabic, Bengali and Chinese survive. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface CsvContext {
  t: (key: string) => string;
  productName: (p: Product) => string;
  staffName: (id: string | null) => string;
  customerName: (c: Customer | undefined) => string;
  customers: Map<string, Customer>;
}

const pct = (n: number | null) => (n === null ? null : Math.round(n * 1000) / 10);

/** One row per sold line. */
export function salesLinesRows(data: ReportData, ctx: CsvContext): Cell[][] {
  const { t } = ctx;
  const head = ['date', 'time', 'sale', 'operator', 'payment', 'customer', 'product', 'qty', 'unit', 'unitPrice', 'lineTotal', 'vatRate', 'taxable', 'vatAmount', 'unitCost', 'margin'].map((k) => t(`csv.${k}`));
  const lines = lineFigures(data).sort((a, b) => Date.parse(a.sale.created_at) - Date.parse(b.sale.created_at) || a.item.line_no - b.item.line_no);
  const body = lines.map((l) => {
    const d = new Date(l.sale.created_at);
    const unitCost = l.item.unit_cost ?? l.product?.cost_price ?? null;
    return [
      localDay(l.sale.created_at),
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      l.sale.id.slice(0, 8).toUpperCase(),
      ctx.staffName(l.sale.staff_id),
      t(`payment.${l.sale.payment_method}`),
      l.sale.customer_id ? ctx.customerName(ctx.customers.get(l.sale.customer_id)) : '',
      l.product ? ctx.productName(l.product) : '?',
      l.quantity,
      t(l.item.weight_kg !== null || (l.product && isWeighed(l.product)) ? 'csv.kg' : 'csv.pcs'),
      l.item.unit_price,
      round2(l.gross),
      l.rate,
      round2(l.net),
      round2(l.gross - l.net),
      unitCost,
      l.cost == null ? null : round2(l.net - l.cost),
    ] as Cell[];
  });
  return [head, ...body];
}

export function productSummaryRows(stats: ProductStat[], productOf: (id: string) => Product | undefined, ctx: CsvContext): Cell[][] {
  const head = ['product', 'qty', 'unit', 'revenue', 'revenueNet', 'cost', 'margin', 'marginPct'].map((k) => ctx.t(`csv.${k}`));
  const body = [...stats]
    .sort((a, b) => b.gross - a.gross)
    .map((s) => {
      const p = productOf(s.productId);
      return [p ? ctx.productName(p) : '?', s.quantity, ctx.t(s.weighed ? 'csv.kg' : 'csv.pcs'), s.gross, s.net, s.margin === null ? null : s.cost, s.margin, pct(s.marginPct)] as Cell[];
    });
  return [head, ...body];
}

export function dailySummaryRows(days: DayRow[], ctx: CsvContext): Cell[][] {
  const head = ['day', 'salesCount', 'total', 'cash', 'card', 'credit', 'customerPayments'].map((k) => ctx.t(`csv.${k}`));
  return [head, ...days.map((d) => [d.day, d.count, d.gross, d.cash, d.card, d.credit, d.customerPayments] as Cell[])];
}
