import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from '../locales/en.json';

export const INTERFACE_LANGUAGES = ['en', 'tl', 'pa', 'hi', 'zh', 'es', 'fr', 'ar'] as const;
export type InterfaceLanguage = typeof INTERFACE_LANGUAGES[number];

export const LOCALES: Record<InterfaceLanguage, string> = {
  en: 'en-CA', tl: 'fil-PH', pa: 'pa-IN', hi: 'hi-IN', zh: 'zh-Hans', es: 'es-ES', fr: 'fr-CA', ar: 'ar',
};

const localeModules = import.meta.glob<{ default: Record<string, string> }>(
  ['../locales/*.json', '!../locales/en.json'],
);

export function interfaceLocale(value: unknown): InterfaceLanguage {
  return INTERFACE_LANGUAGES.find((language) => language === value) || 'en';
}

export const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'en',
  supportedLngs: [...INTERFACE_LANGUAGES],
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false, skipOnVariables: true },
  react: { useSuspense: false },
});

type MessageValues = Record<string, string | number>;

export function l10n(message: string, values?: MessageValues, language?: InterfaceLanguage): string {
  if (!message) return '';
  const locale = language || interfaceLocale(i18n.language);
  const interpolation = locale === 'ar' && values
    ? Object.fromEntries(Object.entries(values).map(([name, value]) => [name, '\u2068' + value + '\u2069']))
    : values;
  return i18n.t(message, { ...interpolation, lng: locale, defaultValue: message });
}

export function useInterfaceLanguage(): InterfaceLanguage {
  const { i18n: instance } = useTranslation(undefined, { i18n });
  return interfaceLocale(instance.language);
}

export function formatUiDate(value: Date, options: Intl.DateTimeFormatOptions) {
  if (Number.isNaN(value.valueOf())) return '';
  return new Intl.DateTimeFormat(LOCALES[interfaceLocale(i18n.language)], options).format(value);
}

export function localizedShift(shift: string) {
  const match = /^(Day|Evening|Night) \((.+)\)$/.exec(shift);
  if (!match) return l10n(shift);
  return l10n('{{shift}} ({{hours}})', { shift: l10n(match[1]), hours: match[2] });
}

export function uiLanguageName(code: string): string {
  try {
    const locale = LOCALES[interfaceLocale(i18n.language)];
    return new Intl.DisplayNames(locale, { type: 'language', fallback: 'none' }).of(code === 'tl' ? 'fil' : code) || code;
  } catch {
    return code;
  }
}

export async function loadInterfaceLocale(language: InterfaceLanguage) {
  if (i18n.hasResourceBundle(language, 'translation')) return;
  const { default: catalog } = await localeModules[`../locales/${language}.json`]();
  i18n.addResourceBundle(language, 'translation', catalog);
}

export function setInterfaceLocale(language: InterfaceLanguage) {
  document.documentElement.lang = LOCALES[language];
  document.documentElement.dir = i18n.dir(language);
  document.title = 'CareBridge · ' + l10n('Handoff', undefined, language);
  void i18n.changeLanguage(language);
}
