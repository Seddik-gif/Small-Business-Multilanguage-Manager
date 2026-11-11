/**
 * What a failed Supabase call means for the sync cycle.
 *  network   – no connection / request never completed: stop the cycle, keep everything pending,
 *              do NOT count it against the rows (it is nobody's fault).
 *  auth      – session missing or expired: stop, ask the owner to sign in again.
 *  transient – 5xx / rate limit: stop and try again next cycle, not the rows' fault.
 *  parent    – foreign-key failure: the parent row failed or is not there yet. Leave pending, retry.
 *  permanent – the server refuses this row (constraint, RLS, bad value): counts toward MAX_ATTEMPTS.
 */
export type FailureKind = 'network' | 'auth' | 'transient' | 'parent' | 'permanent';

interface ErrorLike {
  code?: string;
  message?: string;
  statusCode?: string | number;
}

export function classify(error: ErrorLike, status?: number): FailureKind {
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  const http = status ?? Number(error.statusCode ?? 0);

  if (!code && (http === 0 || /fetch|network|failed to|load failed|timeout|aborted/.test(msg))) return 'network';
  if (http === 401 || code === 'PGRST301' || code === 'PGRST303' || /jwt/.test(msg)) return 'auth';
  if (code === '23503') return 'parent';
  if (http >= 500 || http === 429 || code === '57014' || code === '40001' || code === '40P01') return 'transient';
  return 'permanent';
}

/** Thrown out of a pull to abort the cycle with a classified reason. */
export class SyncAbort extends Error {
  constructor(public kind: 'network' | 'auth' | 'server', message: string) {
    super(message);
    this.name = 'SyncAbort';
  }
}
