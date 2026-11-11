import type { Product } from '@/types/models';

export const NAME_LANGS = ['it', 'en', 'ar', 'bn', 'zh'] as const;
export type NameLang = (typeof NAME_LANGS)[number];
type Names = Pick<Product, 'name_it' | 'name_en' | 'name_ar' | 'name_bn' | 'name_zh'>;

/** Name in the UI language, falling back to Italian (always filled). */
export function productName(p: Names, lng: string): string {
  const key = `name_${lng.slice(0, 2)}` as keyof Names;
  return (p[key] ?? '').trim() || p.name_it;
}

/** Search matches any of the 5 names, or the barcode prefix. */
export function matchesQuery(p: Names & Pick<Product, 'barcode'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (p.barcode && p.barcode.startsWith(q)) return true;
  return NAME_LANGS.some((l) => (p[`name_${l}`] ?? '').toLowerCase().includes(q));
}

/** Products with a price per kg open the weight modal at the till. */
export const isWeighed = (p: Pick<Product, 'price_per_kg'>): boolean => (p.price_per_kg ?? 0) > 0;

export function firstGrapheme(s: string): string {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    const first = new Seg(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next();
    if (!first.done) return first.value.segment.toUpperCase();
  }
  return (Array.from(s)[0] ?? '?').toUpperCase();
}
