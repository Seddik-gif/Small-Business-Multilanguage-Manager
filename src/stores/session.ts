import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Role } from '@/types/models';

export interface ActiveStaff {
  id: string;
  name: string;
  role: Role;
}

/** Who is at the till right now. sessionStorage: survives a reload, not closing the app. */
interface SessionState {
  staff: ActiveStaff | null;
  unlock: (s: ActiveStaff) => void;
  lock: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      staff: null,
      unlock: (staff) => set({ staff }),
      lock: () => set({ staff: null }),
    }),
    { name: 'pos.session', storage: createJSONStorage(() => sessionStorage) },
  ),
);
