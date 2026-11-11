/** Client-side UUIDs let rows be created offline and synced later without id collisions. */
export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

/**
 * A UUID derived from a seed. Two devices that derive it from the same seed get the same id, so a
 * row they both create (receiving one purchase-order line) is ONE row once synced, not two.
 * SHA-256 of the seed, shaped as a v5-style UUID.
 */
export async function deterministicId(seed: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
