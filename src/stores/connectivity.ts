import { create } from 'zustand';

/** Why the last sync cycle did not finish. 'rows' = finished, but the server refused some changes. */
export type SyncError = 'network' | 'auth' | 'server' | 'rows';

interface ConnectivityState {
  online: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  error: SyncError | null;
  errorDetail: string | null;
  setOnline: (v: boolean) => void;
  setSyncing: (v: boolean) => void;
  setSyncResult: (r: { error: SyncError | null; detail?: string | null; at?: string }) => void;
}

export const useConnectivity = create<ConnectivityState>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  lastSyncedAt: null,
  error: null,
  errorDetail: null,
  setOnline: (online) => set({ online }),
  setSyncing: (syncing) => set({ syncing }),
  setSyncResult: ({ error, detail, at }) =>
    set((s) => ({ error, errorDetail: error ? detail ?? null : null, lastSyncedAt: at ?? s.lastSyncedAt })),
}));
