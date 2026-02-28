import type { ItemUsageType } from "@/models/item";
import { parseYmd } from "@/utils/date";

export interface TaxEstimateSettings {
  gwgThresholdCents: number;
  applyHalfYearRule: boolean;
  marginalRateBps: number;
  defaultWorkPercent: number;
}

export interface TaxEstimateInput {
  totalCents: number;
  usageType: ItemUsageType;
  workPercent: number | null;
  purchaseDate: string;
  usefulLifeMonths: number;
}

export interface YearlyDeduction {
  year: number;
  deductibleCents: number;
}

export interface TaxEstimateResult {
  deductibleThisYearCents: number;
  scheduleByYear: YearlyDeduction[];
  estimatedRefundThisYearCents: number;
  explanations: string[];
}

function parsePurchaseDate(value: string): { year: number; month: number; day: number } {
  const parsed = parseYmd(value);
  if (!parsed) {
    throw new Error(`Invalid purchaseDate value: ${value}`);
  }

  return parsed;
}

function resolveWorkSharePercent(
  usageType: ItemUsageType,
  workPercent: number | null,
  defaultWorkPercent: number
): number {
  if (usageType === "PRIVATE" || usageType === "OTHER") {
    return 0;
  }
  if (usageType === "WORK") {
    return 100;
  }

  const percent = workPercent ?? defaultWorkPercent;
  return Math.max(0, Math.min(100, percent));
}

function buildYearMonthAllocations(
  purchaseYear: number,
  purchaseMonth: number,
  usefulLifeMonths: number,
  applyHalfYearRule: boolean
): Array<{ year: number; months: number }> {
  const allocations: Array<{ year: number; months: number }> = [];
  const firstYearMonths = applyHalfYearRule && purchaseMonth > 6 ? 6 : 12;

  let remainingMonths = usefulLifeMonths;
  let year = purchaseYear;

  const firstAllocation = Math.min(firstYearMonths, remainingMonths);
  allocations.push({ year, months: firstAllocation });
  remainingMonths -= firstAllocation;
  year += 1;

  while (remainingMonths > 0) {
    const months = Math.min(12, remainingMonths);
    allocations.push({ year, months });
    remainingMonths -= months;
    year += 1;
  }

  return allocations;
}

function buildScheduleByYear(
  workRelevantCents: number,
  purchaseYear: number,
  purchaseMonth: number,
  usefulLifeMonths: number,
  applyHalfYearRule: boolean
): YearlyDeduction[] {
  const monthAllocations = buildYearMonthAllocations(
    purchaseYear,
    purchaseMonth,
    usefulLifeMonths,
    applyHalfYearRule
  );
  if (monthAllocations.length === 0) {
    return [];
  }

  const schedule: YearlyDeduction[] = [];
  let allocatedCents = 0;
  for (let index = 0; index < monthAllocations.length; index += 1) {
    const allocation = monthAllocations[index];
    const isLast = index === monthAllocations.length - 1;
    const raw = (workRelevantCents * allocation.months) / usefulLifeMonths;
    const deductibleCents = isLast ? workRelevantCents - allocatedCents : Math.floor(raw);
    allocatedCents += deductibleCents;
    schedule.push({
      year: allocation.year,
      deductibleCents,
    });
  }

  return schedule.filter((entry) => entry.deductibleCents > 0);
}

export function estimateTaxImpact(
  input: TaxEstimateInput,
  settings: TaxEstimateSettings,
  taxYear: number
): TaxEstimateResult {
  const purchase = parsePurchaseDate(input.purchaseDate);
  const workSharePercent = resolveWorkSharePercent(
    input.usageType,
    input.workPercent,
    settings.defaultWorkPercent
  );
  const workRelevantCents = Math.round((input.totalCents * workSharePercent) / 100);

  const explanations: string[] = [];
  explanations.push(`Usage type ${input.usageType} resolved to ${workSharePercent}% work share.`);
  explanations.push(`Deductible base amount: ${workRelevantCents} cents.`);

  if (workRelevantCents <= 0) {
    explanations.push("No work-relevant amount. Deduction is 0.");
    return {
      deductibleThisYearCents: 0,
      scheduleByYear: [],
      estimatedRefundThisYearCents: 0,
      explanations,
    };
  }

  let scheduleByYear: YearlyDeduction[] = [];
  if (workRelevantCents <= settings.gwgThresholdCents) {
    explanations.push(
      `Deductible base is below/equal GWG threshold (${settings.gwgThresholdCents} cents), immediate deduction in purchase year.`
    );
    scheduleByYear = [{ year: purchase.year, deductibleCents: workRelevantCents }];
  } else {
    const usefulLifeMonths = Math.max(1, input.usefulLifeMonths);
    explanations.push(
      `Work-relevant amount is above GWG threshold; spreading across ${usefulLifeMonths} months.`
    );
    if (settings.applyHalfYearRule) {
      explanations.push(
        purchase.month > 6
          ? "Half-year rule active and purchase after 30 June: first-year deduction capped to 6 months."
          : "Half-year rule active, but purchase on/before 30 June: full first-year months applied."
      );
    } else {
      explanations.push("Half-year rule disabled.");
    }
    scheduleByYear = buildScheduleByYear(
      workRelevantCents,
      purchase.year,
      purchase.month,
      usefulLifeMonths,
      settings.applyHalfYearRule
    );
  }

  const deductibleThisYearCents =
    scheduleByYear.find((entry) => entry.year === taxYear)?.deductibleCents ?? 0;
  const estimatedRefundThisYearCents = Math.round(
    (deductibleThisYearCents * settings.marginalRateBps) / 10_000
  );

  explanations.push(`Tax year ${taxYear}: deductible ${deductibleThisYearCents} cents.`);
  explanations.push(
    `Estimated refund uses marginal rate ${settings.marginalRateBps} bps.`
  );

  return {
    deductibleThisYearCents,
    scheduleByYear,
    estimatedRefundThisYearCents,
    explanations,
  };
}
