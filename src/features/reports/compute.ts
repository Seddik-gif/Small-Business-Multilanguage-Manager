import { round2 } from '@/lib/money';
import type { DebtPayment, PaymentMethod, Product, Sale, SaleItem } from '@/types/models';

/**
 * Report arithmetic. Pure functions over already-loaded rows, so the numbers can be checked by hand.
 *
 * Conventions (shown to the owner on the report screens):
 *  - Shelf prices include IVA. Margin is worked out on revenue WITHOUT IVA against cost, because the
 *    IVA is owed to the state. Cost prices are taken as entered WITHOUT IVA (what a supplier invoice
 *    shows before IVA).
 *  - A sale-level discount is spread over its lines in proportion to their value, so the IVA split and
 *    the margins add up to what was really charged.
 *  - Cost and IVA rate come from the sale line (what they were when sold); only lines from before that
 *    was recorded fall back to the product's current values.
 *  - Customer payments are treated as cash in the drawer (the app does not record how they were paid).
 */
export interface ReportData {
  sales: Sale[];
  items: SaleItem[];
  products: Map<string, Product>;
  payments: DebtPayment[];
}

const METHODS: PaymentMethod[] = ['cash', 'card', 'credit'];

/** YYYY-MM-DD in the device's own time zone: the shop's day, not UTC's. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface LineFigures {
  sale: Sale;
  item: SaleItem;
  product?: Product;
  /** What the customer paid for this line (discount included), IVA included. */
  gross: number;
  rate: number;
  net: number;
  quantity: number;
  /** Total cost of the line, or null if no cost is known anywhere. */
  cost: number | null;
  /** True when the cost had to be taken from the product's CURRENT cost price. */
  costEstimated: boolean;
}

/** One entry per sold line, with the discount spread in and cost/IVA resolved. */
export function lineFigures(data: ReportData): LineFigures[] {
  const saleById = new Map(data.sales.map((s) => [s.id, s]));
  const lineSum = new Map<string, number>();
  for (const it of data.items) lineSum.set(it.sale_id, (lineSum.get(it.sale_id) ?? 0) + it.total_price);

  const out: LineFigures[] = [];
  for (const item of data.items) {
    const sale = saleById.get(item.sale_id);
    if (!sale) continue; // a line whose sale is outside the period or not yet pulled
    const sum = lineSum.get(sale.id) ?? 0;
    const factor = sum > 0 ? sale.total_amount / sum : 1;
    const gross = item.total_price * factor;
    const product = data.products.get(item.product_id);
    const rate = item.iva_rate ?? product?.iva_rate ?? 22;
    const unitCost = item.unit_cost ?? product?.cost_price ?? null;
    out.push({
      sale,
      item,
      product,
      gross,
      rate,
      net: gross / (1 + rate / 100),
      quantity: item.quantity,
      cost: unitCost == null ? null : unitCost * item.quantity,
      costEstimated: item.unit_cost == null && unitCost != null,
    });
  }
  return out;
}

export interface MethodTotal {
  count: number;
  amount: number;
}

export interface ZReport {
  count: number;
  /** Total sold, after discounts, IVA included. */
  gross: number;
  discount: number;
  average: number;
  byMethod: Record<PaymentMethod, MethodTotal>;
  customerPayments: MethodTotal;
  /** Cash + card + customer payments: money that actually came in. */
  collected: number;
  /** What should be in the drawer from today's takings: cash sales + customer payments. */
  expectedCash: number;
  vat: { rate: number; gross: number; taxable: number; tax: number }[];
  byStaff: { staffId: string | null; count: number; amount: number }[];
}

export function zReport(data: ReportData): ZReport {
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, { count: 0, amount: 0 }])) as Record<PaymentMethod, MethodTotal>;
  const staff = new Map<string | null, { count: number; amount: number }>();
  let gross = 0;
  let discount = 0;
  for (const s of data.sales) {
    gross += s.total_amount;
    discount += s.discount_amount ?? 0;
    byMethod[s.payment_method].count++;
    byMethod[s.payment_method].amount += s.total_amount;
    const st = staff.get(s.staff_id) ?? { count: 0, amount: 0 };
    st.count++;
    st.amount += s.total_amount;
    staff.set(s.staff_id, st);
  }
  for (const m of METHODS) byMethod[m].amount = round2(byMethod[m].amount);

  const byRate = new Map<number, number>();
  for (const l of lineFigures(data)) byRate.set(l.rate, (byRate.get(l.rate) ?? 0) + l.gross);
  const vat = [...byRate]
    .sort(([a], [b]) => a - b)
    .map(([rate, g]) => {
      const taxable = g / (1 + rate / 100);
      return { rate, gross: round2(g), taxable: round2(taxable), tax: round2(g) - round2(taxable) };
    })
    .map((v) => ({ ...v, tax: round2(v.tax) }));

  const customerPayments = { count: data.payments.length, amount: round2(data.payments.reduce((s, p) => s + p.amount, 0)) };
  const count = data.sales.length;
  return {
    count,
    gross: round2(gross),
    discount: round2(discount),
    average: count ? round2(gross / count) : 0,
    byMethod,
    customerPayments,
    collected: round2(byMethod.cash.amount + byMethod.card.amount + customerPayments.amount),
    expectedCash: round2(byMethod.cash.amount + customerPayments.amount),
    vat,
    byStaff: [...staff].map(([staffId, v]) => ({ staffId, count: v.count, amount: round2(v.amount) })).sort((a, b) => b.amount - a.amount),
  };
}

export interface ProductStat {
  productId: string;
  /** Pieces, or kg for weighed products. */
  quantity: number;
  weighed: boolean;
  gross: number;
  net: number;
  /** Cost of the lines whose cost is known. */
  cost: number;
  /** Revenue (without IVA) of those same lines: the margin is measured on this. */
  netCovered: number;
  /** Net revenue minus cost on covered lines; null when no line has a cost. */
  margin: number | null;
  marginPct: number | null;
  /** Lines whose cost came from the product's current price rather than the sale itself. */
  estimatedLines: number;
  /** Lines with no cost anywhere (left out of the margin). */
  unknownLines: number;
}

export interface Totals {
  gross: number;
  net: number;
  cost: number;
  netCovered: number;
  margin: number | null;
  marginPct: number | null;
  /** Share of net revenue that has a cost, 0–1: how far to trust the margin. */
  coverage: number;
  estimatedLines: number;
  unknownLines: number;
  lines: number;
}

export function productStats(data: ReportData): { stats: ProductStat[]; totals: Totals } {
  const map = new Map<string, ProductStat>();
  const t = { gross: 0, net: 0, cost: 0, netCovered: 0, estimatedLines: 0, unknownLines: 0, lines: 0 };
  for (const l of lineFigures(data)) {
    const id = l.item.product_id;
    const s =
      map.get(id) ??
      ({
        productId: id,
        quantity: 0,
        weighed: l.item.weight_kg !== null,
        gross: 0,
        net: 0,
        cost: 0,
        netCovered: 0,
        margin: null,
        marginPct: null,
        estimatedLines: 0,
        unknownLines: 0,
      } as ProductStat);
    s.quantity += l.quantity;
    s.gross += l.gross;
    s.net += l.net;
    t.gross += l.gross;
    t.net += l.net;
    t.lines++;
    if (l.cost == null) {
      s.unknownLines++;
      t.unknownLines++;
    } else {
      s.cost += l.cost;
      s.netCovered += l.net;
      t.cost += l.cost;
      t.netCovered += l.net;
      if (l.costEstimated) {
        s.estimatedLines++;
        t.estimatedLines++;
      }
    }
    map.set(id, s);
  }
  const finish = <T extends { cost: number; netCovered: number }>(x: T) => {
    const covered = x.netCovered > 0 || x.cost > 0;
    const margin = covered ? x.netCovered - x.cost : null;
    return { margin: margin === null ? null : round2(margin), marginPct: margin !== null && x.netCovered > 0 ? margin / x.netCovered : null };
  };
  const stats = [...map.values()].map((s) => ({
    ...s,
    quantity: Math.round(s.quantity * 1000) / 1000,
    gross: round2(s.gross),
    net: round2(s.net),
    cost: round2(s.cost),
    netCovered: round2(s.netCovered),
    ...finish(s),
  }));
  return {
    stats,
    totals: {
      gross: round2(t.gross),
      net: round2(t.net),
      cost: round2(t.cost),
      netCovered: round2(t.netCovered),
      ...finish(t),
      coverage: t.net > 0 ? t.netCovered / t.net : 0,
      estimatedLines: t.estimatedLines,
      unknownLines: t.unknownLines,
      lines: t.lines,
    },
  };
}

export interface DayRow {
  day: string;
  count: number;
  gross: number;
  cash: number;
  card: number;
  credit: number;
  customerPayments: number;
}

/** One row per day that had any activity, oldest first. */
export function dailyRows(data: ReportData): DayRow[] {
  const days = new Map<string, DayRow>();
  const row = (day: string) =>
    days.get(day) ?? (days.set(day, { day, count: 0, gross: 0, cash: 0, card: 0, credit: 0, customerPayments: 0 }), days.get(day)!);
  for (const s of data.sales) {
    const r = row(localDay(s.created_at));
    r.count++;
    r.gross += s.total_amount;
    r[s.payment_method] += s.total_amount;
  }
  for (const p of data.payments) row(localDay(p.payment_date)).customerPayments += p.amount;
  return [...days.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => ({ ...r, gross: round2(r.gross), cash: round2(r.cash), card: round2(r.card), credit: round2(r.credit), customerPayments: round2(r.customerPayments) }));
}
