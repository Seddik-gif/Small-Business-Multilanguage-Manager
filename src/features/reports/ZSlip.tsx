import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { makeMoneyFormatter } from '@/lib/money';
import { getShopName } from '@/lib/shop';
import type { ZReport } from './compute';

/**
 * Print-only copy of the Z-report (80 mm slip), portalled outside #root so window.print() outputs just
 * this. It is NOT a fiscal document: the app is a "gestionale", not a registratore telematico.
 */
export function ZSlip({ day, z, staffName, counted }: { day: string; z: ZReport; staffName: (id: string | null) => string; counted: number | null }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  const money = makeMoneyFormatter(lng);
  const row = (label: string, value: string, bold = false) => (
    <div className={`flex justify-between gap-2 ${bold ? 'font-bold' : ''}`}>
      <span dir="auto">{label}</span>
      <span dir="ltr" className="shrink-0">{value}</span>
    </div>
  );

  return createPortal(
    <div className="print-area">
      <div className="mx-auto w-full max-w-[72mm] bg-white font-mono text-[12px] leading-snug text-black">
        <div className="mb-2 text-center">
          <div className="text-base font-bold">{getShopName()}</div>
          <div className="font-bold">{t('reports.zTitle')}</div>
          <div dir="ltr">{day}</div>
        </div>
        <div className="space-y-0.5 border-y border-dashed border-black py-1">
          {row(t('reports.salesCount'), String(z.count))}
          {row(t('reports.sold'), money(z.gross), true)}
          {z.discount > 0 && row(t('reports.discounts'), money(z.discount))}
        </div>
        <div className="space-y-0.5 py-1">
          {(['cash', 'card', 'credit'] as const).map((m) => row(`${t(`payment.${m}`)} (${z.byMethod[m].count})`, money(z.byMethod[m].amount)))}
        </div>
        <div className="space-y-0.5 border-t border-dashed border-black py-1">
          {row(t('reports.customerPayments'), money(z.customerPayments.amount))}
          {row(t('reports.collected'), money(z.collected), true)}
          {row(t('reports.expectedCash'), money(z.expectedCash))}
          {counted !== null && row(t('reports.counted'), money(counted))}
          {counted !== null && row(t('reports.difference'), money(Math.round((counted - z.expectedCash) * 100) / 100), true)}
        </div>
        {z.vat.length > 0 && (
          <table className="w-full border-t border-dashed border-black text-[11px]">
            <thead>
              <tr>
                <th className="text-start font-normal">{t('receipt.vat')}</th>
                <th className="text-end font-normal">{t('receipt.taxable')}</th>
                <th className="text-end font-normal">{t('receipt.vat')}</th>
              </tr>
            </thead>
            <tbody>
              {z.vat.map((v) => (
                <tr key={v.rate}>
                  <td>{v.rate}%</td>
                  <td className="text-end">{money(v.taxable)}</td>
                  <td className="text-end">{money(v.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {z.byStaff.length > 1 && (
          <div className="space-y-0.5 border-t border-dashed border-black py-1">
            {z.byStaff.map((s) => row(`${staffName(s.staffId)} (${s.count})`, money(s.amount)))}
          </div>
        )}
        <div className="mt-2 border-t border-dashed border-black pt-1 text-center text-[11px]">
          <div className="font-bold">DOCUMENTO NON FISCALE</div>
          <div dir="ltr">{t('reports.generated', { time: new Date().toLocaleString(`${lng}-u-nu-latn`) })}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
