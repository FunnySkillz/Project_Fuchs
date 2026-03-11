import { estimateTaxImpact } from "@/domain/calculation-engine";
import { estimateAustrianMarginalRateBpsFromAnnualGrossCents } from "@/domain/austrian-marginal-rate";
import {
  DEFAULT_MARGINAL_RATE_BPS,
  type SalaryPaymentsPerYear,
} from "@/models/profile-settings";

export interface TaxCalculationSettingsFormInput {
  taxYearDefault: string;
  monthlyGrossIncomeEuros: string;
  salaryPaymentsPerYear: SalaryPaymentsPerYear;
  useManualMarginalTaxRate: boolean;
  manualMarginalRatePercent: string;
  defaultWorkPercent: string;
  gwgThresholdEuros: string;
  applyHalfYearRule: boolean;
  werbungskostenPauschaleEnabled: boolean;
  werbungskostenPauschaleAmountCents: number;
}

export interface TaxCalculationSettingsUpsertValues {
  taxYearDefault: number;
  monthlyGrossIncomeCents: number;
  salaryPaymentsPerYear: SalaryPaymentsPerYear;
  useManualMarginalTaxRate: boolean;
  manualMarginalRateBps: number;
  autoEstimatedMarginalRateBps: number;
  effectiveMarginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: boolean;
  werbungskostenPauschaleEnabled: boolean;
  werbungskostenPauschaleAmountCents: number;
}

interface ValidationSuccess {
  valid: true;
  fieldErrors: Record<string, string>;
  values: TaxCalculationSettingsUpsertValues;
}

interface ValidationFailure {
  valid: false;
  fieldErrors: Record<string, string>;
}

export type TaxCalculationSettingsValidation = ValidationSuccess | ValidationFailure;

export interface TaxCalculationPreview {
  sampleItemCents: number;
  workRelevantCents: number;
  deductibleThisYearCents: number;
  estimatedRefundCents: number;
  modeLabel: "GWG" | "AfA";
  marginalRateUsedBps: number;
}

function parseNumber(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSalaryPaymentsPerYear(input: number): SalaryPaymentsPerYear | null {
  if (!Number.isFinite(input)) {
    return null;
  }
  const rounded = Math.round(input);
  return rounded === 12 || rounded === 14 ? rounded : null;
}

export function validateTaxCalculationSettingsFormInput(
  input: TaxCalculationSettingsFormInput
): TaxCalculationSettingsValidation {
  const fieldErrors: Record<string, string> = {};

  const parsedTaxYear = parseNumber(input.taxYearDefault);
  if (parsedTaxYear === null || !Number.isInteger(parsedTaxYear)) {
    fieldErrors.taxYearDefault = "Tax year must be a whole number.";
  } else if (parsedTaxYear < 2000 || parsedTaxYear > 2100) {
    fieldErrors.taxYearDefault = "Tax year must be between 2000 and 2100.";
  }

  const parsedMonthlyGrossEuros = parseNumber(input.monthlyGrossIncomeEuros);
  if (parsedMonthlyGrossEuros === null) {
    fieldErrors.monthlyGrossIncomeEuros = "Monthly gross income is required.";
  } else if (parsedMonthlyGrossEuros < 0) {
    fieldErrors.monthlyGrossIncomeEuros = "Monthly gross income must be 0 or higher.";
  }

  const parsedSalaryPayments = toSalaryPaymentsPerYear(input.salaryPaymentsPerYear);
  if (!parsedSalaryPayments) {
    fieldErrors.salaryPaymentsPerYear = "Salary payments per year must be 12 or 14.";
  }

  const parsedManualRate = parseNumber(input.manualMarginalRatePercent);
  if (input.useManualMarginalTaxRate) {
    if (parsedManualRate === null) {
      fieldErrors.manualMarginalRatePercent = "Marginal tax rate is required when override is enabled.";
    } else if (parsedManualRate < 0 || parsedManualRate > 100) {
      fieldErrors.manualMarginalRatePercent = "Marginal tax rate must be between 0 and 100%.";
    }
  }

  const parsedWorkPercent = parseNumber(input.defaultWorkPercent);
  if (parsedWorkPercent === null) {
    fieldErrors.defaultWorkPercent = "Default work percent is required.";
  } else if (parsedWorkPercent < 0 || parsedWorkPercent > 100) {
    fieldErrors.defaultWorkPercent = "Default work percent must be between 0 and 100%.";
  }

  const parsedGwgThresholdEuros = parseNumber(input.gwgThresholdEuros);
  if (parsedGwgThresholdEuros === null) {
    fieldErrors.gwgThresholdEuros = "GWG threshold is required.";
  } else if (parsedGwgThresholdEuros < 0) {
    fieldErrors.gwgThresholdEuros = "GWG threshold must be 0 or higher.";
  }

  if (input.werbungskostenPauschaleAmountCents < 0) {
    fieldErrors.werbungskostenPauschaleAmountCents =
      "Werbungskostenpauschale amount must be 0 or higher.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }

  const taxYearDefault = Math.round(parsedTaxYear!);
  const monthlyGrossIncomeCents = Math.round(parsedMonthlyGrossEuros! * 100);
  const salaryPaymentsPerYear = parsedSalaryPayments!;
  const annualGrossCents = monthlyGrossIncomeCents * salaryPaymentsPerYear;
  const autoEstimatedMarginalRateBps = estimateAustrianMarginalRateBpsFromAnnualGrossCents(
    annualGrossCents,
    taxYearDefault
  ).marginalRateBps;
  const manualMarginalRateBps =
    parsedManualRate !== null && parsedManualRate >= 0 && parsedManualRate <= 100
      ? Math.round(parsedManualRate * 100)
      : DEFAULT_MARGINAL_RATE_BPS;
  const effectiveMarginalRateBps = input.useManualMarginalTaxRate
    ? manualMarginalRateBps
    : autoEstimatedMarginalRateBps;

  return {
    valid: true,
    fieldErrors,
    values: {
      taxYearDefault,
      monthlyGrossIncomeCents,
      salaryPaymentsPerYear,
      useManualMarginalTaxRate: input.useManualMarginalTaxRate,
      manualMarginalRateBps,
      autoEstimatedMarginalRateBps,
      effectiveMarginalRateBps,
      defaultWorkPercent: Math.round(parsedWorkPercent!),
      gwgThresholdCents: Math.round(parsedGwgThresholdEuros! * 100),
      applyHalfYearRule: input.applyHalfYearRule,
      werbungskostenPauschaleEnabled: input.werbungskostenPauschaleEnabled,
      werbungskostenPauschaleAmountCents: Math.round(input.werbungskostenPauschaleAmountCents),
    },
  };
}

export function buildTaxCalculationPreview(
  values: TaxCalculationSettingsUpsertValues
): TaxCalculationPreview {
  const sampleItemCents = 150_000;
  const estimate = estimateTaxImpact(
    {
      totalCents: sampleItemCents,
      usageType: "MIXED",
      workPercent: values.defaultWorkPercent,
      purchaseDate: `${values.taxYearDefault}-07-15`,
      usefulLifeMonths: 36,
    },
    {
      gwgThresholdCents: values.gwgThresholdCents,
      applyHalfYearRule: values.applyHalfYearRule,
      marginalRateBps: values.effectiveMarginalRateBps,
      defaultWorkPercent: values.defaultWorkPercent,
    },
    values.taxYearDefault
  );
  const workRelevantCents = Math.round((sampleItemCents * values.defaultWorkPercent) / 100);

  return {
    sampleItemCents,
    workRelevantCents,
    deductibleThisYearCents: estimate.deductibleThisYearCents,
    estimatedRefundCents: estimate.estimatedRefundThisYearCents,
    modeLabel: estimate.scheduleByYear.length === 1 ? "GWG" : "AfA",
    marginalRateUsedBps: values.effectiveMarginalRateBps,
  };
}
