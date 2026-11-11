import type { ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { SalesScreen } from '@/features/sales/SalesScreen';
import { ProductsPage } from '@/features/products/ProductsPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { useRole } from '@/hooks/useRole';

/** Cashiers only get the sales screen (and language settings); no costs, margins or reports. */
function OwnerOnly({ children }: { children: ReactNode }) {
  const { loading, role } = useRole();
  if (loading) return null;
  return role === 'owner' ? <>{children}</> : <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <SalesScreen /> },
      { path: '/products', element: <OwnerOnly><ProductsPage /></OwnerOnly> },
      { path: '/customers', element: <OwnerOnly><CustomersPage /></OwnerOnly> },
      { path: '/inventory', element: <OwnerOnly><InventoryPage /></OwnerOnly> },
      { path: '/reports', element: <OwnerOnly><ReportsPage /></OwnerOnly> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);
