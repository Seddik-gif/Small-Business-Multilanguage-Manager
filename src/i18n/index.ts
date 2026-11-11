import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import it from './locales/it.json';
import en from './locales/en.json';
import ar from './locales/ar.json';
import bn from './locales/bn.json';
import zh from './locales/zh.json';

export const LANGUAGES = [
  { code: 'it', label: 'Italiano', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'bn', label: 'বাংলা', dir: 'ltr' },
  { code: 'zh', label: '中文', dir: 'ltr' },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];
export const isRtl = (lng: string) => lng.startsWith('ar');

/** Keep <html lang/dir> in sync so Tailwind rtl:/logical utilities mirror the layout. */
function applyDocumentDirection(lng: string) {
  document.documentElement.lang = lng;
  document.documentElement.dir = isRtl(lng) ? 'rtl' : 'ltr';
}

// Bundled (not lazy-loaded over HTTP) so every language works offline from first boot.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { it: { translation: it }, en: { translation: en }, ar: { translation: ar }, bn: { translation: bn }, zh: { translation: zh } },
    fallbackLng: 'it',
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage'], lookupLocalStorage: 'pos.lang', caches: ['localStorage'] },
  });

applyDocumentDirection(i18n.resolvedLanguage ?? 'it');
i18n.on('languageChanged', applyDocumentDirection);

/**
 * The Chinese font is cut into 100 slices fetched by need. Ask for every character in the Chinese UI as
 * soon as Chinese is chosen, so those slices are downloaded (and cached for offline) while the till is
 * still online, not on the first sale of the day.
 */
function warmChineseFont(lng: string) {
  if (lng !== 'zh' || typeof document === 'undefined' || !document.fonts?.load) return;
  const text = (function flatten(o: unknown): string {
    return typeof o === 'string' ? o : o && typeof o === 'object' ? Object.values(o).map(flatten).join('') : '';
  })(zh);
  void document.fonts.load('16px "Noto Sans SC Variable"', text).catch(() => undefined);
  void document.fonts.load('700 16px "Noto Sans SC Variable"', text).catch(() => undefined);
}
warmChineseFont(i18n.resolvedLanguage ?? 'it');
i18n.on('languageChanged', warmChineseFont);

export default i18n;
