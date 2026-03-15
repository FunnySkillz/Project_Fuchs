import type { AppLocale } from "@/i18n/types";

export function formatCurrencyCents(cents: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatNumber(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number, locale: AppLocale, fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
