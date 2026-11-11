export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** Accepts "1,50" (Italian) as well as "1.50". Returns null for empty/invalid input. */
export function parseNum(s: string): number | null {
  const v = s.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Latin digits in every language (-u-nu-latn): Arabic and Bengali locales would otherwise
 * render native digits, which don't match scales, price tags or receipts in Italy.
 */
export function makeMoneyFormatter(lng: string): (n: number) => string {
  const f = new Intl.NumberFormat(`${lng}-u-nu-latn`, { style: 'currency', currency: 'EUR' });
  return (n) => f.format(n);
}

export function formatKg(kg: number, lng: string): string {
  return `${new Intl.NumberFormat(`${lng}-u-nu-latn`, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(kg)} kg`;
}
