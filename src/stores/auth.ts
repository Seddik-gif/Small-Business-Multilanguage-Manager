import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LinkedToOtherAccountError, linkDeviceToAccount } from '@/auth/linkDevice';

/**
 * Owner account state (Supabase Auth). Separate from staff PINs (stores/session.ts):
 * the account links the device to the shop once; PINs switch who is at the till.
 *   disabled  – Supabase not configured: local-only mode, sync never runs
 *   signedOut – no session: app works offline, sync paused
 *   linking   – session found, device→account migration running
 *   linked    – migration done; the only state in which sync may run
 *   error     – migration refused (e.g. device linked to another account); sync paused
 */
export type AuthStatus = 'disabled' | 'signedOut' | 'linking' | 'linked' | 'error';

interface AuthState {
  status: AuthStatus;
  uid: string | null;
  email: string | null;
  error: 'linkedOther' | 'linkFailed' | null;
}

export const useAuth = create<AuthState>(() => ({
  status: supabase ? 'signedOut' : 'disabled',
  uid: null,
  email: null,
  error: null,
}));

async function onSession(session: Session | null) {
  if (!session) {
    useAuth.setState({ status: 'signedOut', uid: null, email: null, error: null });
    return;
  }
  const { uid, status } = useAuth.getState();
  if (uid === session.user.id && status === 'linked') return; // token refresh etc.
  useAuth.setState({ status: 'linking', uid: session.user.id, email: session.user.email ?? null, error: null });
  try {
    await linkDeviceToAccount(session.user.id);
    useAuth.setState({ status: 'linked' });
    const { syncNow } = await import('@/sync/engine');
    void syncNow();
  } catch (e) {
    console.error('Device link failed', e);
    useAuth.setState({ status: 'error', error: e instanceof LinkedToOtherAccountError ? 'linkedOther' : 'linkFailed' });
  }
}

export function initAuth(): void {
  if (!supabase) return;
  // Fires INITIAL_SESSION immediately (from storage, works offline), then on every change.
  // Deferred with setTimeout: supabase-js must not be awaited inside this callback.
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => void onSession(session), 0);
  });
}
