/**
 * WhatsApp's wa.me links want the number as digits only, with the country code and no "+" or "00".
 *   "+880 1712-345678"  → "8801712345678"
 *   "0039 333 123 4567" → "393331234567"
 *   "333 123 4567"      → "393331234567"   (no prefix: assume Italy, the shop's country)
 * A foreign number typed in local format ("01712345678") cannot be told apart from an Italian
 * landline, so the form asks for a "+prefix" on foreign numbers.
 */
export const DEFAULT_COUNTRY = '39';

export function normalizePhone(raw: string, country = DEFAULT_COUNTRY): string | null {
  let s = raw.trim().replace(/[\s().-]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  else s = country + s;
  // E.164: at most 15 digits; shorter than 8 is not a real number.
  return /^\d{8,15}$/.test(s) ? s : null;
}

export function waLink(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
