import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, Lock, Package, Settings, ShoppingCart, Users, Warehouse, type LucideIcon } from 'lucide-react';
import { PinLock } from '@/features/staff/PinLock';
import { useReorderCount } from '@/features/inventory/lowStock';
import { useStaffLanguage } from '@/hooks/useStaffLanguage';
import { useRole } from '@/hooks/useRole';
import { useSession } from '@/stores/session';
import type { Role } from '@/types/models';
import { OnlineIndicator } from './OnlineIndicator';

const NAV: { to: string; key: string; icon: LucideIcon; roles: Role[] }[] = [
  { to: '/', key: 'nav.sales', icon: ShoppingCart, roles: ['owner', 'cashier'] },
  { to: '/products', key: 'nav.products', icon: Package, roles: ['owner'] },
  { to: '/customers', key: 'nav.customers', icon: Users, roles: ['owner'] },
  { to: '/inventory', key: 'nav.inventory', icon: Warehouse, roles: ['owner'] },
  { to: '/reports', key: 'nav.reports', icon: BarChart3, roles: ['owner'] },
  { to: '/settings', key: 'nav.settings', icon: Settings, roles: ['owner', 'cashier'] },
];

/** Red count on the Magazzino menu item: products that need reordering. */
function Badge({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white ${className}`}>
      {n}
    </span>
  );
}

/**
 * Side nav on tablets/desktop, bottom tab bar on phones.
 * Uses only logical utilities (border-e, ps-*, start-*) so Arabic mirrors automatically.
 * Once any staff PIN exists, the whole app sits behind the PIN lock.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const { loading, locked, role } = useRole();
  const { staff, lock } = useSession();
  const reorderCount = useReorderCount(); // hooks before the early returns below
  useStaffLanguage();

  if (loading) return null;
  if (locked) return <PinLock />;

  const nav = NAV.filter((n) => n.roles.includes(role));
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium md:flex-row md:justify-start md:gap-3 md:px-4 md:py-3 md:text-base ${
      isActive ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900 md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-e border-slate-200 bg-white p-3 md:flex">
        <div className="mb-4 px-2">
          <div className="text-lg font-bold text-emerald-700">{t('app.name')}</div>
          <div className="text-xs text-slate-500">{t('app.tagline')}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(({ to, key, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkCls}>
              <Icon className="h-5 w-5 shrink-0" /> <span>{t(key)}</span>
              {to === '/inventory' && reorderCount > 0 && <Badge n={reorderCount} className="ms-auto" />}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* min-h-0: without it this column grows to its content on phones (flex-col parent) and the whole
          page scrolls, taking the header and bottom menu with it; with it only <main> scrolls. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-1">
          <span className="font-semibold md:hidden">{t('app.name')}</span>
          <OnlineIndicator />
          {staff && (
            <button type="button" className="btn ms-auto text-sm text-slate-600 hover:bg-slate-100" onClick={lock} title={t('auth.switchUser')}>
              <span dir="auto">{staff.name}</span>
              <span className="rounded bg-slate-100 px-1.5 text-xs">{t(`role.${staff.role}`)}</span>
              <Lock className="h-4 w-4" />
            </button>
          )}
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4">
          <Outlet />
        </main>
        <nav className="grid gap-1 border-t border-slate-200 bg-white p-1 md:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map(({ to, key, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={`${linkCls} relative`}>
              <Icon className="h-5 w-5" /> <span className="truncate">{t(key)}</span>
              {to === '/inventory' && reorderCount > 0 && <Badge n={reorderCount} className="absolute end-1 top-0 md:hidden" />}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
