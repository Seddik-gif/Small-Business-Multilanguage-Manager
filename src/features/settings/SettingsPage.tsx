import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { StaffManager } from '@/features/staff/StaffManager';
import { useRole } from '@/hooks/useRole';
import { getShopName, setShopName } from '@/lib/shop';
import { AccountPanel } from './AccountPanel';

/** Everyone can change the language; shop, account and staff settings are owner-only. */
export function SettingsPage() {
  const { t } = useTranslation();
  const { role } = useRole();
  const [shopName, setName] = useState(getShopName);
  return (
    <section className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
        <span className="font-medium">{t('settings.language')}</span>
        <LanguageSwitcher />
      </div>
      {role === 'owner' && (
        <>
          <label className="block rounded-xl bg-white p-4 shadow-sm">
            <span className="label">{t('settings.shopName')}</span>
            <input className="input" dir="auto" value={shopName} onChange={(e) => { setName(e.target.value); setShopName(e.target.value); }} />
          </label>
          <AccountPanel />
          <StaffManager />
        </>
      )}
    </section>
  );
}
