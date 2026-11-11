import { useTranslation } from 'react-i18next';
import { db } from '@/db';
import { saveRecord, stamp } from '@/db/repo';
import { LANGUAGES } from '@/i18n';
import { useSession } from '@/stores/session';
import type { Staff } from '@/types/models';

/**
 * Changes the language now, and remembers it for the person at the till (their staff record), so it
 * comes back the next time they unlock, on any till. Before anyone has unlocked it is the device's choice.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const change = async (code: string) => {
    await i18n.changeLanguage(code);
    const active = useSession.getState().staff;
    if (!active) return;
    const row = await db.staff.get(active.id);
    if (row && row.language_preference !== code) await saveRecord('staff', stamp<Staff>({ ...row, language_preference: code }, row));
  };

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t('settings.language')}</span>
      <select
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        value={i18n.resolvedLanguage}
        onChange={(e) => void change(e.target.value)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}
