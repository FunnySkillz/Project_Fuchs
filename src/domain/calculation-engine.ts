import type {
  ItemPurchaseKind,
  ItemUsageType,
  SubscriptionBillingCadence,
} from "@/models/item";
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
  purchaseKind?: ItemPurchaseKind;
  billingCadence?: SubscriptionBillingCadence | null;
  subscriptionEndDate?: string | null;
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

interface YearMonth {
  year: number;
  month: number;
}

function parseDateOrThrow(
  fieldName: "purchaseDate" | "subscriptionEndDate",
  value: string
): { year: number; month: number; day: number } {
  const parsed = parseYmd(value);
  if (!parsed) {
    throw new Error(`Invalid ${fieldName} value: ${value}`);
  }
  return parsed;
}

function compareYmd(
  left: { year: number; month: number; day: number },
  right: { year: number; month: number; day: number }
): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }
  if (left.month !== right.month) {
    return left.month - right.month;
  }
  return left.day - right.day;
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
): { year: number; months: number }[] {
  const allocations: { year: number; months: number }[] = [];
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

function buildOneTimeScheduleByYear(
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

function compareYearMonth(left: YearMonth, right: YearMonth): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }
  return left.month - right.month;
}

function nextYearMonth(value: YearMonth): YearMonth {
  if (value.month === 12) {
    return { year: value.year + 1, month: 1 };
  }
  return { year: value.year, month: value.month + 1 };
}

function minYearMonth(left: YearMonth, right: YearMonth): YearMonth {
  return compareYearMonth(left, right) <= 0 ? left : right;
}

function monthlyShareForYearlyCadence(totalCents: number, monthOffset: number): number {
  const monthIndex = monthOffset % 12;
  const from = Math.floor((totalCents * monthIndex) / 12);
  const to = Math.floor((totalCents * (monthIndex + 1)) / 12);
  return to - from;
}

function buildSubscriptionRawAmountsByYear(
  totalCents: number,
  billingCadence: SubscriptionBillingCadence,
  startMonth: YearMonth,
  endMonth: YearMonth
): Map<number, number> {
  const rawByYear = new Map<number, number>();
  let cursor = { ...startMonth };
  let offset = 0;
  while (compareYearMonth(cursor, endMonth) <= 0) {
    const monthChargeCents =
      billingCadence === "MONTHLY"
        ? totalCents
        : monthlyShareForYearlyCadence(totalCents, offset);
    rawByYear.set(cursor.year, (rawByYear.get(cursor.year) ?? 0) + monthChargeCents);
    cursor = nextYearMonth(cursor);
    offset += 1;
  }
  return rawByYear;
}

function buildSubscriptionScheduleByYear(
  totalCents: number,
  workSharePercent: number,
  billingCadence: SubscriptionBillingCadence,
  purchase: { year: number; month: number; day: number },
  subscriptionEndDate: { year: number; month: number; day: number } | null,
  taxYear: number
): YearlyDeduction[] {
  const startMonth: YearMonth = { year: purchase.year, month: purchase.month };
  const selectedTaxYearEndMonth: YearMonth = { year: taxYear, month: 12 };
  const rawEndMonth: YearMonth = subscriptionEndDate
    ? { year: subscriptionEndDate.year, month: subscriptionEndDate.month }
    : selectedTaxYearEndMonth;
  const endMonth = minYearMonth(rawEndMonth, selectedTaxYearEndMonth);
  if (compareYearMonth(endMonth, startMonth) < 0) {
    return [];
  }

  const rawByYear = buildSubscriptionRawAmountsByYear(
    totalCents,
    billingCadence,
    startMonth,
    endMonth
  );

  return Array.from(rawByYear.entries())
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, rawCents]) => ({
      year,
      deductibleCents: Math.round((rawCents * workSharePercent) / 100),
    }))
    .filter((entry) => entry.deductibleCents > 0);
}

function estimateOneTimeImpact(
  input: TaxEstimateInput,
  settings: TaxEstimateSettings,
  taxYear: number,
  purchase: { year: number; month: number; day: number },
  workRelevantCents: number,
  explanations: string[]
): TaxEstimateResult {
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
    scheduleByYear = buildOneTimeScheduleByYear(
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
  explanations.push(`Estimated refund uses marginal rate ${settings.marginalRateBps} bps.`);

  return {
    deductibleThisYearCents,
    scheduleByYear,
    estimatedRefundThisYearCents,
    explanations,
  };
}

function estimateSubscriptionImpact(
  input: TaxEstimateInput,
  settings: TaxEstimateSettings,
  taxYear: number,
  purchase: { year: number; month: number; day: number },
  workSharePercent: number,
  explanations: string[]
): TaxEstimateResult {
  if (!input.billingCadence) {
    throw new Error("billingCadence is required for SUBSCRIPTION items.");
  }
  const subscriptionEndDate = input.subscriptionEndDate
    ? parseDateOrThrow("subscriptionEndDate", input.subscriptionEndDate)
    : null;
  if (subscriptionEndDate && compareYmd(subscriptionEndDate, purchase) < 0) {
    throw new Error("subscriptionEndDate cannot be before purchaseDate.");
  }

  explanations.push(`Subscription mode active with ${input.billingCadence} cadence.`);
  if (subscriptionEndDate) {
    explanations.push(`Subscription period: ${input.purchaseDate} to ${input.subscriptionEndDate}.`);
  } else {
    explanations.push(`Subscription ongoing from ${input.purchaseDate}.`);
    explanations.push(`Ongoing schedule truncated at tax year ${taxYear}.`);
  }

  const scheduleByYear = buildSubscriptionScheduleByYear(
    input.totalCents,
    workSharePercent,
    input.billingCadence,
    purchase,
    subscriptionEndDate,
    taxYear
  );
  const deductibleThisYearCents =
    scheduleByYear.find((entry) => entry.year === taxYear)?.deductibleCents ?? 0;
  const estimatedRefundThisYearCents = Math.round(
    (deductibleThisYearCents * settings.marginalRateBps) / 10_000
  );

  explanations.push(`Tax year ${taxYear}: deductible ${deductibleThisYearCents} cents.`);
  explanations.push(`Estimated refund uses marginal rate ${settings.marginalRateBps} bps.`);

  return {
    deductibleThisYearCents,
    scheduleByYear,
    estimatedRefundThisYearCents,
    explanations,
  };
}

export function estimateTaxImpact(
  input: TaxEstimateInput,
  settings: TaxEstimateSettings,
  taxYear: number
): TaxEstimateResult {
  const purchase = parseDateOrThrow("purchaseDate", input.purchaseDate);
  const workSharePercent = resolveWorkSharePercent(
    input.usageType,
    input.workPercent,
    settings.defaultWorkPercent
  );
  const workRelevantCents = Math.round((input.totalCents * workSharePercent) / 100);

  const explanations: string[] = [];
  explanations.push(`Usage type ${input.usageType} resolved to ${workSharePercent}% work share.`);
  explanations.push(`Deductible base amount: ${workRelevantCents} cents.`);

  if (workRelevantCents <= 0 || input.totalCents <= 0) {
    explanations.push("No work-relevant amount. Deduction is 0.");
    return {
      deductibleThisYearCents: 0,
      scheduleByYear: [],
      estimatedRefundThisYearCents: 0,
      explanations,
    };
  }

  const purchaseKind: ItemPurchaseKind = input.purchaseKind === "SUBSCRIPTION" ? "SUBSCRIPTION" : "ONE_TIME";
  if (purchaseKind === "SUBSCRIPTION") {
    return estimateSubscriptionImpact(
      input,
      settings,
      taxYear,
      purchase,
      workSharePercent,
      explanations
    );
  }

  return estimateOneTimeImpact(
    input,
    settings,
    taxYear,
    purchase,
    workRelevantCents,
    explanations
  );
}
