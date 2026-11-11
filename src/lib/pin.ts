/**
 * Staff PINs are verified on the device so switching cashier works offline.
 * Stored as PBKDF2-SHA256 with a per-staff random salt: "pbkdf2$<iterations>$<salt>$<hash>".
 *
 * Honest limit: a 4–6 digit PIN has at most 1,000,000 combinations, so anyone who can read this
 * device's IndexedDB can brute-force it. The PIN decides who is at the till (role switch), it
 * does not protect the data on a stolen device. The owner's Supabase account is the real secret.
 */
const ITERATIONS = 100_000;
export const PIN_RE = /^\d{4,6}$/;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: BufferSource, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(pin, salt, ITERATIONS))}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const actual = new Uint8Array(await derive(pin, unb64(salt), Number(iter)));
  const expected = unb64(hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
