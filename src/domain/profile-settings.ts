import { createDefaultProfileSettings, type ProfileSettings } from "@/models/profile-settings";

const MIN_TAX_YEAR = 2000;
const MAX_TAX_YEAR = 2100;
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const MIN_BPS = 0;
const MAX_BPS = 10_000;
const MIN_GWG_THRESHOLD_CENTS = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sanitizeInteger(input: number, fallback: number, min: number, max?: number): number {
  if (!Number.isFinite(input)) {
    return fallback;
  }

  const rounded = Math.round(input);
  if (max === undefined) {
    return Math.max(rounded, min);
  }

  return clamp(rounded, min, max);
}

function sanitizePercent(input: number, fallback: number): number {
  if (!Number.isFinite(input)) {
    return fallback;
  }

  return sanitizeInteger(input, fallback, MIN_PERCENT, MAX_PERCENT);
}

function sanitizeBps(input: number, fallback: number): number {
  if (!Number.isFinite(input)) {
    return fallback;
  }

  return sanitizeInteger(input, fallback, MIN_BPS, MAX_BPS);
}

export function normalizeProfileSettings(
  partial: Partial<ProfileSettings>,
  fallback: ProfileSettings = createDefaultProfileSettings()
): ProfileSettings {
  return {
    taxYearDefault: sanitizeInteger(
      partial.taxYearDefault ?? fallback.taxYearDefault,
      fallback.taxYearDefault,
      MIN_TAX_YEAR,
      MAX_TAX_YEAR
    ),
    marginalRateBps: sanitizeBps(
      partial.marginalRateBps ?? fallback.marginalRateBps,
      fallback.marginalRateBps
    ),
    defaultWorkPercent: sanitizePercent(
      partial.defaultWorkPercent ?? fallback.defaultWorkPercent,
      fallback.defaultWorkPercent
    ),
    gwgThresholdCents: sanitizeInteger(
      partial.gwgThresholdCents ?? fallback.gwgThresholdCents,
      fallback.gwgThresholdCents,
      MIN_GWG_THRESHOLD_CENTS
    ),
    applyHalfYearRule: partial.applyHalfYearRule ?? fallback.applyHalfYearRule,
    appLockEnabled: partial.appLockEnabled ?? fallback.appLockEnabled,
    currency: "EUR",
  };
}
