export interface ProfileSettings {
  taxYearDefault: number;
  marginalRate: number;
  defaultWorkPercent: number;
  gwgThreshold: number;
  applyHalfYearRule: boolean;
}

export const DEFAULT_GWG_THRESHOLD_CENTS = 100_000;
export const DEFAULT_MARGINAL_RATE_PERCENT = 30;
export const DEFAULT_WORK_PERCENT = 100;

export function createDefaultProfileSettings(now: Date = new Date()): ProfileSettings {
  return {
    taxYearDefault: now.getFullYear(),
    marginalRate: DEFAULT_MARGINAL_RATE_PERCENT,
    defaultWorkPercent: DEFAULT_WORK_PERCENT,
    gwgThreshold: DEFAULT_GWG_THRESHOLD_CENTS,
    applyHalfYearRule: false,
  };
}
