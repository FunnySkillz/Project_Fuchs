import React from "react";

import { getLocaleForLanguage, translate, translatePlural, type PluralTranslationKey, type TranslationKey } from "@/i18n/translate";
import type { AppLanguage, AppLocale, InterpolationValues } from "@/i18n/types";

export interface LanguageContextValue {
  language: AppLanguage;
  locale: AppLocale;
  setLanguage: (next: AppLanguage) => void;
  t: (key: TranslationKey, values?: InterpolationValues) => string;
  tPlural: (
    key: PluralTranslationKey,
    count: number,
    values?: InterpolationValues
  ) => string;
}

const noop = () => undefined;

const defaultLanguage: AppLanguage = "en";
const defaultLocale = getLocaleForLanguage(defaultLanguage);

export const LanguageContext = React.createContext<LanguageContextValue>({
  language: defaultLanguage,
  locale: defaultLocale,
  setLanguage: noop,
  t: (key, values) => translate(defaultLanguage, key, values),
  tPlural: (key, count, values) => translatePlural(defaultLanguage, key, count, values),
});

export function useI18n(): LanguageContextValue {
  return React.useContext(LanguageContext);
}
