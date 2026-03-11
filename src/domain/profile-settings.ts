import { createDefaultProfileSettings, type ProfileSettings } from "@/models/profile-settings";
import { isThemeMode } from "@/theme/theme-mode";

const MIN_TAX_YEAR = 2000;
const MAX_TAX_YEAR = 2100;
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const MIN_BPS = 0;
const MAX_BPS = 10_000;
const MIN_GWG_THRESHOLD_CENTS = 0;
const MIN_MONTHLY_GROSS_CENTS = 0;
const MIN_WERBUNGSKOSTEN_PAUSCHALE_AMOUNT_CENTS = 0;

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

function sanitizeSalaryPaymentsPerYear(input: number, fallback: 12 | 14): 12 | 14 {
  if (!Number.isFinite(input)) {
    return fallback;
  }
  const rounded = Math.round(input);
  return rounded === 12 || rounded === 14 ? rounded : fallback;
}

export function normalizeProfileSettings(
  partial: Partial<ProfileSettings>,
  fallback: ProfileSettings = createDefaultProfileSettings()
): ProfileSettings {
  const themeModeCandidate = partial.themeModePreference ?? fallback.themeModePreference;
  const themeModePreference = isThemeMode(themeModeCandidate)
    ? themeModeCandidate
    : fallback.themeModePreference;

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
    monthlyGrossIncomeCents: sanitizeInteger(
      partial.monthlyGrossIncomeCents ?? fallback.monthlyGrossIncomeCents,
      fallback.monthlyGrossIncomeCents,
      MIN_MONTHLY_GROSS_CENTS
    ),
    salaryPaymentsPerYear: sanitizeSalaryPaymentsPerYear(
      partial.salaryPaymentsPerYear ?? fallback.salaryPaymentsPerYear,
      fallback.salaryPaymentsPerYear
    ),
    useManualMarginalTaxRate:
      partial.useManualMarginalTaxRate ?? fallback.useManualMarginalTaxRate,
    manualMarginalRateBps: sanitizeBps(
      partial.manualMarginalRateBps ?? fallback.manualMarginalRateBps,
      fallback.manualMarginalRateBps
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
    werbungskostenPauschaleEnabled:
      partial.werbungskostenPauschaleEnabled ?? fallback.werbungskostenPauschaleEnabled,
    werbungskostenPauschaleAmountCents: sanitizeInteger(
      partial.werbungskostenPauschaleAmountCents ?? fallback.werbungskostenPauschaleAmountCents,
      fallback.werbungskostenPauschaleAmountCents,
      MIN_WERBUNGSKOSTEN_PAUSCHALE_AMOUNT_CENTS
    ),
    appLockEnabled: partial.appLockEnabled ?? fallback.appLockEnabled,
    uploadToOneDriveAfterExport:
      partial.uploadToOneDriveAfterExport ?? fallback.uploadToOneDriveAfterExport,
    themeModePreference,
    currency: "EUR",
  };
}
