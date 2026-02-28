export interface ProfileSettings {
  taxYearDefault: number;
  marginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: boolean;
  appLockEnabled: boolean;
  uploadToOneDriveAfterExport: boolean;
  currency: "EUR";
}

export const DEFAULT_GWG_THRESHOLD_CENTS = 100_000;
export const DEFAULT_MARGINAL_RATE_BPS = 4_000;
export const DEFAULT_WORK_PERCENT = 100;

export function createDefaultProfileSettings(now: Date = new Date()): ProfileSettings {
  return {
    taxYearDefault: now.getFullYear(),
    marginalRateBps: DEFAULT_MARGINAL_RATE_BPS,
    defaultWorkPercent: DEFAULT_WORK_PERCENT,
    gwgThresholdCents: DEFAULT_GWG_THRESHOLD_CENTS,
    applyHalfYearRule: false,
    appLockEnabled: false,
    uploadToOneDriveAfterExport: false,
    currency: "EUR",
  };
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}
