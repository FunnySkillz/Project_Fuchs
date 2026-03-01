export interface ProfileSettingsFormInput {
  taxYearDefault: string;
  marginalRatePercent: string;
  defaultWorkPercent: string;
  gwgThresholdEuros: string;
  applyHalfYearRule: boolean;
  appLockEnabled: boolean;
  uploadToOneDriveAfterExport: boolean;
}

export interface ProfileSettingsUpsertValues {
  taxYearDefault: number;
  marginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: boolean;
  appLockEnabled: boolean;
  uploadToOneDriveAfterExport: boolean;
}

interface ProfileSettingsValidationSuccess {
  valid: true;
  fieldErrors: Record<string, string>;
  values: ProfileSettingsUpsertValues;
}

interface ProfileSettingsValidationFailure {
  valid: false;
  fieldErrors: Record<string, string>;
}

export type ProfileSettingsValidation =
  | ProfileSettingsValidationSuccess
  | ProfileSettingsValidationFailure;

function parseNumber(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function validateProfileSettingsFormInput(
  input: ProfileSettingsFormInput
): ProfileSettingsValidation {
  const fieldErrors: Record<string, string> = {};

  const parsedTaxYear = parseNumber(input.taxYearDefault);
  if (parsedTaxYear === null || !Number.isInteger(parsedTaxYear)) {
    fieldErrors.taxYearDefault = "Tax year must be a whole number.";
  } else if (parsedTaxYear < 2000 || parsedTaxYear > 2100) {
    fieldErrors.taxYearDefault = "Tax year must be between 2000 and 2100.";
  }

  const parsedRate = parseNumber(input.marginalRatePercent);
  if (parsedRate === null) {
    fieldErrors.marginalRatePercent = "Marginal tax rate is required.";
  } else if (parsedRate < 0 || parsedRate > 55) {
    fieldErrors.marginalRatePercent = "Marginal tax rate must be between 0 and 55%.";
  }

  const parsedWorkPercent = parseNumber(input.defaultWorkPercent);
  if (parsedWorkPercent === null) {
    fieldErrors.defaultWorkPercent = "Default work percent is required.";
  } else if (parsedWorkPercent < 0 || parsedWorkPercent > 100) {
    fieldErrors.defaultWorkPercent = "Default work percent must be between 0 and 100%.";
  }

  const parsedGwgThreshold = parseNumber(input.gwgThresholdEuros);
  if (parsedGwgThreshold === null) {
    fieldErrors.gwgThresholdEuros = "GWG threshold is required.";
  } else if (parsedGwgThreshold < 0) {
    fieldErrors.gwgThresholdEuros = "GWG threshold must be 0 or higher.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }

  return {
    valid: true,
    fieldErrors,
    values: {
      taxYearDefault: Math.round(parsedTaxYear!),
      marginalRateBps: Math.round(parsedRate! * 100),
      defaultWorkPercent: Math.round(parsedWorkPercent!),
      gwgThresholdCents: Math.round(parsedGwgThreshold! * 100),
      applyHalfYearRule: input.applyHalfYearRule,
      appLockEnabled: input.appLockEnabled,
      uploadToOneDriveAfterExport: input.uploadToOneDriveAfterExport,
    },
  };
}
