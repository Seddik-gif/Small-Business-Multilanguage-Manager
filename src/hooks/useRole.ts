import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useSession } from '@/stores/session';
import type { Role } from '@/types/models';

/**
 * staffCount === 0: no PINs set up yet, the device acts as the owner (first-run bootstrap).
 * staffCount > 0: someone must unlock with a PIN; role comes from that staff member.
 * The active staff member is re-checked against the table, so removing someone locks them out.
 */
export function useRole(): { loading: boolean; locked: boolean; role: Role } {
  const staff = useSession((s) => s.staff);
  const state = useLiveQuery(async () => {
    const all = await db.staff.filter((s) => !s.deleted).toArray();
    const current = staff ? all.find((s) => s.id === staff.id) : undefined;
    return { count: all.length, currentRole: current?.role };
  }, [staff?.id]);

  if (!state) return { loading: true, locked: false, role: 'cashier' };
  if (state.count === 0) return { loading: false, locked: false, role: 'owner' };
  if (!state.currentRole) return { loading: false, locked: true, role: 'cashier' };
  return { loading: false, locked: false, role: state.currentRole };
}
