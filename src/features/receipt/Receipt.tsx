import { useTranslation } from 'react-i18next';
import { formatKg, makeMoneyFormatter, round2 } from '@/lib/money';
import { productName } from '@/lib/product';
import { getShopName } from '@/lib/shop';
import type { Customer, Product, Sale, SaleItem } from '@/types/models';

export interface ReceiptData {
  sale: Sale;
  items: SaleItem[];
  products: (Product | undefined)[];
  /** Set on credit sales. The receipt never shows what the customer owes in total. */
  customer?: Customer;
}

/**
 * Prices are IVA-inclusive; split each rate into taxable base + tax for the breakdown.
 * The rate is the one stored on the line when it was sold (not the product's current one), and a
 * discount is spread over the lines in proportion, so the table adds up to what was really charged.
 */
function ivaBreakdown(sale: Sale, items: SaleItem[], products: (Product | undefined)[]) {
  const sum = items.reduce((s, it) => s + it.total_price, 0);
  const factor = sum > 0 ? sale.total_amount / sum : 1;
  const byRate = new Map<number, number>();
  items.forEach((it, i) => {
    const rate = it.iva_rate ?? products[i]?.iva_rate ?? 22;
    byRate.set(rate, (byRate.get(rate) ?? 0) + it.total_price * factor);
  });
  return [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, gross]) => {
      const taxable = round2(gross / (1 + rate / 100));
      return { rate, taxable, tax: round2(gross - taxable) };
    });
}

/** Internal, non-fiscal receipt sized for 80 mm thermal paper (also prints fine on A4 / PDF). */
export function Receipt({ data, tendered }: { data: ReceiptData; tendered?: number | null }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = makeMoneyFormatter(lng);
  const { sale, items, products } = data;
  const date = new Date(sale.created_at);
  const change = tendered != null ? round2(tendered - sale.total_amount) : null;

  return (
    <div className="mx-auto w-full max-w-[72mm] bg-white font-mono text-[12px] leading-snug text-black">
      <div className="mb-2 text-center">
        <div className="text-base font-bold">{getShopName()}</div>
        <div dir="ltr">{date.toLocaleString(`${lng}-u-nu-latn`)}</div>
        <div>{t('receipt.sale')} #{sale.id.slice(0, 8).toUpperCase()}</div>
      </div>
      <div className="border-y border-dashed border-black py-1">
        {items.map((it, i) => {
          const p = products[i];
          return (
            <div key={it.id} className="py-0.5">
              <div className="flex justify-between gap-2">
                <span dir="auto">{p ? productName(p, lng) : '?'}</span>
                <span className="shrink-0">{money(it.total_price)}</span>
              </div>
              <div dir="ltr" className="text-[11px] text-slate-600">
                {it.weight_kg !== null ? `${formatKg(it.weight_kg, lng)} × ${money(it.unit_price)}/kg` : `${it.quantity} × ${money(it.unit_price)}`}
              </div>
            </div>
          );
        })}
      </div>
      {sale.discount_amount > 0 && (
        <div className="py-1">
          <div className="flex justify-between"><span>{t('receipt.subtotal')}</span><span>{money(round2(sale.total_amount + sale.discount_amount))}</span></div>
          <div className="flex justify-between"><span>{t('receipt.discount')}</span><span>−{money(sale.discount_amount)}</span></div>
        </div>
      )}
      <div className="flex justify-between py-1 text-base font-bold">
        <span>{t('common.total')}</span>
        <span>{money(sale.total_amount)}</span>
      </div>
      <table className="mb-1 w-full text-[11px]">
        <thead>
          <tr className="text-start">
            <th className="text-start font-normal">{t('receipt.vat')}</th>
            <th className="text-end font-normal">{t('receipt.taxable')}</th>
            <th className="text-end font-normal">{t('receipt.vat')}</th>
          </tr>
        </thead>
        <tbody>
          {ivaBreakdown(sale, items, products).map((r) => (
            <tr key={r.rate}>
              <td>{r.rate}%</td>
              <td className="text-end">{money(r.taxable)}</td>
              <td className="text-end">{money(r.tax)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-black pt-1">
        <div className="flex justify-between">
          <span>{t('receipt.paidWith')}</span>
          <span>{t(`payment.${sale.payment_method}`)}</span>
        </div>
        {sale.payment_method === 'credit' && (
          <>
            <div className="flex justify-between gap-2"><span>{t('receipt.customer')}</span><span dir="auto" className="text-end">{data.customer?.name ?? '?'}</span></div>
            <div className="font-bold">{t('receipt.onCredit')}</div>
          </>
        )}
        {tendered != null && (
          <>
            <div className="flex justify-between"><span>{t('checkout.tendered')}</span><span>{money(tendered)}</span></div>
            <div className="flex justify-between"><span>{t('checkout.change')}</span><span>{money(change!)}</span></div>
          </>
        )}
      </div>
      <div className="mt-2 border-t border-dashed border-black pt-1 text-center text-[11px]">
        {/* Always in Italian: this is the legally meaningful statement. */}
        <div className="font-bold">DOCUMENTO NON FISCALE</div>
        {lng !== 'it' && <div>{t('receipt.nonFiscal')}</div>}
        <div className="mt-1">{t('receipt.thanks')}</div>
      </div>
    </div>
  );
}
