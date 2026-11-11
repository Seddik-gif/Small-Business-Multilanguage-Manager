import { useEffect } from 'react';
import { db } from '@/db';
import i18n, { LANGUAGES } from '@/i18n';
import { useSession } from '@/stores/session';

/**
 * "Language persisted per user": when someone unlocks the till, the app switches to the language saved
 * on their staff record (set whenever they change it in the language selector). A Bengali-speaking
 * cashier gets Bengali, the owner gets Italian, on every till, with no extra step.
 *
 * It must run ONLY when the signed-in person changes. It uses the i18n singleton rather than the
 * object from useTranslation(), and depends on the staff id alone: if it re-ran on every language
 * change it would read the record before the new choice is saved and switch straight back.
 */
export function useStaffLanguage(): void {
  const staffId = useSession((s) => s.staff?.id);

  useEffect(() => {
    if (!staffId) return;
    let cancelled = false;
    void db.staff.get(staffId).then((row) => {
      const lang = row?.language_preference;
      if (!cancelled && lang && lang !== i18n.resolvedLanguage && LANGUAGES.some((l) => l.code === lang)) {
        void i18n.changeLanguage(lang);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [staffId]);
}
