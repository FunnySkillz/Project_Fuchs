import { deMessages } from "@/i18n/messages/de";
import { enMessages } from "@/i18n/messages/en";
import type { AppLanguage, AppLocale, InterpolationValues, MessageValue, PluralMessage } from "@/i18n/types";

type EnCatalog = typeof enMessages;

export type TranslationKey = {
  [K in keyof EnCatalog]: EnCatalog[K] extends string ? K : never;
}[keyof EnCatalog];

export type PluralTranslationKey = {
  [K in keyof EnCatalog]: EnCatalog[K] extends PluralMessage ? K : never;
}[keyof EnCatalog];

const languageToLocaleMap: Record<AppLanguage, AppLocale> = {
  en: "en-AT",
  de: "de-AT",
};

function getMessageFromCatalog(
  catalog: Partial<EnCatalog>,
  key: keyof EnCatalog
): MessageValue | undefined {
  return catalog[key];
}

function isPluralMessage(value: MessageValue | undefined): value is PluralMessage {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    value !== null &&
    typeof value.one === "string" &&
    typeof value.other === "string"
  );
}

function interpolate(template: string, values?: InterpolationValues): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? full : String(value);
  });
}

function resolveStringMessage(language: AppLanguage, key: TranslationKey): string {
  if (language === "de") {
    const deValue = getMessageFromCatalog(deMessages, key);
    if (typeof deValue === "string") {
      return deValue;
    }
  }

  const enValue = getMessageFromCatalog(enMessages, key);
  if (typeof enValue === "string") {
    return enValue;
  }

  if (__DEV__) {
    throw new Error(`Missing translation key in English catalog: ${String(key)}`);
  }
  return String(key);
}

function resolvePluralMessage(language: AppLanguage, key: PluralTranslationKey): PluralMessage {
  if (language === "de") {
    const deValue = getMessageFromCatalog(deMessages, key);
    if (isPluralMessage(deValue)) {
      return deValue;
    }
  }

  const enValue = getMessageFromCatalog(enMessages, key);
  if (isPluralMessage(enValue)) {
    return enValue;
  }

  if (__DEV__) {
    throw new Error(`Missing plural translation key in English catalog: ${String(key)}`);
  }

  return {
    one: String(key),
    other: String(key),
  };
}

export function getLocaleForLanguage(language: AppLanguage): AppLocale {
  return languageToLocaleMap[language];
}

export function translate(
  language: AppLanguage,
  key: TranslationKey,
  values?: InterpolationValues
): string {
  const message = resolveStringMessage(language, key);
  return interpolate(message, values);
}

export function translatePlural(
  language: AppLanguage,
  key: PluralTranslationKey,
  count: number,
  values?: InterpolationValues
): string {
  const locale = getLocaleForLanguage(language);
  const message = resolvePluralMessage(language, key);
  const pluralRules = new Intl.PluralRules(locale);
  const category = count === 0 && message.zero ? "zero" : pluralRules.select(count);
  const template =
    category === "zero" && message.zero
      ? message.zero
      : category === "one"
        ? message.one
        : message.other;

  return interpolate(template, {
    ...values,
    count,
  });
}
