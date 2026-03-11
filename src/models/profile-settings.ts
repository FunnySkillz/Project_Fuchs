import type { ThemeMode } from "@/theme/theme-mode";

export type SalaryPaymentsPerYear = 12 | 14;

export interface ProfileSettings {
  taxYearDefault: number;
  marginalRateBps: number;
  monthlyGrossIncomeCents: number;
  salaryPaymentsPerYear: SalaryPaymentsPerYear;
  useManualMarginalTaxRate: boolean;
  manualMarginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: boolean;
  werbungskostenPauschaleEnabled: boolean;
  werbungskostenPauschaleAmountCents: number;
  appLockEnabled: boolean;
  uploadToOneDriveAfterExport: boolean;
  themeModePreference: ThemeMode;
  currency: "EUR";
}

export const DEFAULT_GWG_THRESHOLD_CENTS = 100_000;
export const DEFAULT_MARGINAL_RATE_BPS = 4_000;
export const DEFAULT_WORK_PERCENT = 100;
export const DEFAULT_MONTHLY_GROSS_INCOME_CENTS = 0;
export const DEFAULT_SALARY_PAYMENTS_PER_YEAR: SalaryPaymentsPerYear = 14;
export const DEFAULT_USE_MANUAL_MARGINAL_TAX_RATE = false;
export const DEFAULT_WERBUNGSKOSTEN_PAUSCHALE_ENABLED = true;
export const DEFAULT_WERBUNGSKOSTEN_PAUSCHALE_AMOUNT_CENTS = 13_200;

export function createDefaultProfileSettings(now: Date = new Date()): ProfileSettings {
  return {
    taxYearDefault: now.getFullYear(),
    marginalRateBps: DEFAULT_MARGINAL_RATE_BPS,
    monthlyGrossIncomeCents: DEFAULT_MONTHLY_GROSS_INCOME_CENTS,
    salaryPaymentsPerYear: DEFAULT_SALARY_PAYMENTS_PER_YEAR,
    useManualMarginalTaxRate: DEFAULT_USE_MANUAL_MARGINAL_TAX_RATE,
    manualMarginalRateBps: DEFAULT_MARGINAL_RATE_BPS,
    defaultWorkPercent: DEFAULT_WORK_PERCENT,
    gwgThresholdCents: DEFAULT_GWG_THRESHOLD_CENTS,
    applyHalfYearRule: false,
    werbungskostenPauschaleEnabled: DEFAULT_WERBUNGSKOSTEN_PAUSCHALE_ENABLED,
    werbungskostenPauschaleAmountCents: DEFAULT_WERBUNGSKOSTEN_PAUSCHALE_AMOUNT_CENTS,
    appLockEnabled: false,
    uploadToOneDriveAfterExport: false,
    themeModePreference: "system",
    currency: "EUR",
  };
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}
