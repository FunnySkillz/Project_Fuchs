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
const i18nWarningCache = new Set<string>();

function isDevelopmentRuntime(): boolean {
  if (typeof __DEV__ === "boolean") {
    return __DEV__;
  }
  return process.env.NODE_ENV !== "production";
}

function warnI18n(message: string): void {
  if (i18nWarningCache.has(message)) {
    return;
  }
  i18nWarningCache.add(message);
  console.warn(message);
}

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
  const missingKeys = new Set<string>();
  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) => {
    if (!values) {
      missingKeys.add(key);
      return full;
    }
    const value = values[key];
    if (value === undefined || value === null) {
      missingKeys.add(key);
      return full;
    }
    return String(value);
  });

  if (missingKeys.size > 0) {
    const missing = Array.from(missingKeys).sort().join(", ");
    const message = `Missing interpolation value(s) for key(s): ${missing} in template "${template}"`;
    if (isDevelopmentRuntime()) {
      throw new Error(message);
    }
    warnI18n(`i18n warning: ${message}`);
  }

  return rendered;
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

  if (isDevelopmentRuntime()) {
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

  if (isDevelopmentRuntime()) {
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
