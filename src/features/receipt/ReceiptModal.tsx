import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Printer } from 'lucide-react';
import { db } from '@/db';
import { Modal } from '@/components/ui/Modal';
import { Receipt, type ReceiptData } from './Receipt';

async function loadReceipt(saleId: string): Promise<ReceiptData | null> {
  const sale = await db.sales.get(saleId);
  if (!sale) return null;
  const items = (await db.sale_items.where('sale_id').equals(saleId).toArray()).sort((a, b) => a.line_no - b.line_no);
  const products = await db.products.bulkGet(items.map((i) => i.product_id));
  const customer = sale.customer_id ? await db.customers.get(sale.customer_id) : undefined;
  return { sale, items, products, customer };
}

/**
 * On-screen preview + a print-only copy portalled outside #root, so window.print()
 * (or "Save as PDF" in the print dialog) outputs just the receipt.
 */
export function ReceiptModal({ saleId, tendered, onClose }: { saleId: string; tendered?: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const data = useLiveQuery(() => loadReceipt(saleId), [saleId]);

  return (
    <>
      <Modal
        title={t('receipt.title')}
        onClose={onClose}
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary h-12" onClick={() => window.print()} disabled={!data}>
              <Printer className="h-5 w-5" /> {t('common.print')}
            </button>
            <button type="button" className="btn-primary h-12" onClick={onClose}>
              {t('receipt.newSale')}
            </button>
          </div>
        }
      >
        {data ? <div className="rounded-lg border border-slate-200 p-3"><Receipt data={data} tendered={tendered} /></div> : t('common.loading')}
      </Modal>
      {data && createPortal(<div className="print-area"><Receipt data={data} tendered={tendered} /></div>, document.body)}
    </>
  );
}
