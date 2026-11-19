// Languages: German (source texts) and English.
// The German UI text itself is the translation key: t('Speichern') -> "Save" in English.
// A missing translation simply shows the German text. Demo contents stay German.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

export type Lang = 'de' | 'en';
const KEY = 'tagnera.lang'; // new key, existing storage keys stay untouched

function detect(): Lang {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  // default: language of the device, otherwise German
  for (const l of navigator.languages ?? [navigator.language]) {
    if (l?.toLowerCase().startsWith('de')) return 'de';
    if (l?.toLowerCase().startsWith('en')) return 'en';
  }
  return 'de';
}

void i18next.use(initReactI18next).init({
  lng: detect(),
  fallbackLng: false,
  resources: { en: { translation: en }, de: { translation: {} } },
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
  initImmediate: false,
});
document.documentElement.lang = i18next.language;

/** Translate a German UI text. Placeholders: t('Fällig am {{date}}', { date }) */
export function t(key: string, values?: Record<string, unknown>): string {
  return i18next.t(key, { defaultValue: key, ...values }) as string;
}

/** alias used in components (many components use `t` as a local variable name) */
export const tr = t;

export const getLang = (): Lang => (i18next.language === 'en' ? 'en' : 'de');
export const locale = () => (getLang() === 'en' ? 'en-GB' : 'de-DE');
export const speechLang = () => (getLang() === 'en' ? 'en-US' : 'de-DE');

export function setLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l;
  void i18next.changeLanguage(l);
}

/** Label maps that translate on access (work anywhere, also outside components). */
export function translated<T extends Record<string, string>>(map: T): T {
  return new Proxy(map, { get: (o, k) => (typeof k === 'string' && k in o ? t(o[k as keyof T] as string) : undefined) });
}

export { i18next };
