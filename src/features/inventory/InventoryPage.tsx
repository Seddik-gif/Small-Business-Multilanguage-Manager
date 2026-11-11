import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrdersTab } from './OrdersTab';
import { PurchaseOrderModal, type OrderPrefill } from './PurchaseOrderModal';
import { StockTab } from './StockTab';
import { SuppliersTab } from './SuppliersTab';
import { WasteModal } from './WasteModal';
import { WasteTab } from './WasteTab';
import { useReorderCount } from './lowStock';

type Tab = 'stock' | 'orders' | 'suppliers' | 'waste';
const TABS: Tab[] = ['stock', 'orders', 'suppliers', 'waste'];

/** Magazzino: stock levels and alerts, purchase orders, suppliers, waste. Owner only. */
export function InventoryPage() {
  const { t } = useTranslation();
  const reorderCount = useReorderCount();
  const [tab, setTab] = useState<Tab>('stock');
  const [order, setOrder] = useState<{ id: string | null; prefill?: OrderPrefill[] } | null>(null);
  const [waste, setWaste] = useState<{ productId?: string } | null>(null);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.inventory')}</h1>
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`btn flex-1 whitespace-nowrap ${tab === id ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            {t(`inventory.tab.${id}`)}
            {id === 'stock' && reorderCount > 0 && <span className="rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">{reorderCount}</span>}
          </button>
        ))}
      </div>

      {tab === 'stock' && <StockTab onOrder={(prefill) => { setOrder({ id: null, prefill }); setTab('orders'); }} onWaste={(productId) => setWaste({ productId })} />}
      {tab === 'orders' && <OrdersTab onOpen={(id) => setOrder({ id })} />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'waste' && <WasteTab onAdd={() => setWaste({})} />}

      {order && <PurchaseOrderModal orderId={order.id} prefill={order.prefill} onClose={() => setOrder(null)} />}
      {waste && <WasteModal productId={waste.productId} onClose={() => setWaste(null)} />}
    </section>
  );
}
