import type {
  ItemPurchaseKind,
  ItemUsageType,
  SubscriptionBillingCadence,
} from "@/models/item";
import { isValidYmd, parseYmd } from "@/utils/date";

export type ItemValidationField =
  | "title"
  | "purchaseDate"
  | "totalCents"
  | "workPercent"
  | "warrantyMonths"
  | "billingCadence"
  | "subscriptionEndDate";

export type ItemValidationCode =
  | "TITLE_REQUIRED"
  | "PURCHASE_DATE_INVALID"
  | "TOTAL_CENTS_INVALID"
  | "WORK_PERCENT_REQUIRED_FOR_MIXED"
  | "WORK_PERCENT_OUT_OF_RANGE"
  | "WARRANTY_MONTHS_NEGATIVE"
  | "BILLING_CADENCE_REQUIRED_FOR_SUBSCRIPTION"
  | "SUBSCRIPTION_END_DATE_INVALID"
  | "SUBSCRIPTION_END_DATE_BEFORE_START";

export interface ItemValidationError {
  field: ItemValidationField;
  code: ItemValidationCode;
  message: string;
}

export interface ValidateItemInput {
  title: string;
  purchaseDate: string;
  totalCents: number | null;
  usageType: ItemUsageType;
  workPercent: number | null;
  warrantyMonths: number | null;
  purchaseKind: ItemPurchaseKind;
  billingCadence: SubscriptionBillingCadence | null;
  subscriptionEndDate: string | null;
}

export interface ItemValidationResult {
  valid: boolean;
  errors: ItemValidationError[];
  resolvedWorkPercent: number;
}

type SubscriptionValidationMessageKey =
  | "item.validation.billingCadenceRequiredForSubscription"
  | "item.validation.subscriptionEndDateInvalid"
  | "item.validation.subscriptionEndDateBeforeStart";

function getSubscriptionValidationMessageKey(
  code: ItemValidationCode
): SubscriptionValidationMessageKey | null {
  if (code === "BILLING_CADENCE_REQUIRED_FOR_SUBSCRIPTION") {
    return "item.validation.billingCadenceRequiredForSubscription";
  }
  if (code === "SUBSCRIPTION_END_DATE_INVALID") {
    return "item.validation.subscriptionEndDateInvalid";
  }
  if (code === "SUBSCRIPTION_END_DATE_BEFORE_START") {
    return "item.validation.subscriptionEndDateBeforeStart";
  }
  return null;
}

export function resolveItemValidationMessage(
  error: Pick<ItemValidationError, "code" | "message">,
  translate: (key: SubscriptionValidationMessageKey) => string
): string {
  const key = getSubscriptionValidationMessageKey(error.code);
  if (!key) {
    return error.message;
  }
  return translate(key);
}

function resolveWorkPercent(usageType: ItemUsageType, workPercent: number | null): number {
  if (usageType === "WORK") {
    return 100;
  }
  if (usageType === "PRIVATE" || usageType === "OTHER") {
    return 0;
  }
  return workPercent ?? 0;
}

function compareDateStrings(left: string, right: string): number {
  const leftParsed = parseYmd(left);
  const rightParsed = parseYmd(right);
  if (!leftParsed || !rightParsed) {
    return 0;
  }
  if (leftParsed.year !== rightParsed.year) {
    return leftParsed.year - rightParsed.year;
  }
  if (leftParsed.month !== rightParsed.month) {
    return leftParsed.month - rightParsed.month;
  }
  return leftParsed.day - rightParsed.day;
}

export function validateItemInput(input: ValidateItemInput): ItemValidationResult {
  const errors: ItemValidationError[] = [];

  if (input.title.trim().length === 0) {
    errors.push({
      field: "title",
      code: "TITLE_REQUIRED",
      message: "Title is required.",
    });
  }

  if (!isValidYmd(input.purchaseDate)) {
    errors.push({
      field: "purchaseDate",
      code: "PURCHASE_DATE_INVALID",
      message: "Purchase date must be valid (YYYY-MM-DD).",
    });
  }

  if (input.totalCents === null || input.totalCents <= 0) {
    errors.push({
      field: "totalCents",
      code: "TOTAL_CENTS_INVALID",
      message: "Total price is required and must be greater than 0.",
    });
  }

  if (input.usageType === "MIXED") {
    if (input.workPercent === null) {
      errors.push({
        field: "workPercent",
        code: "WORK_PERCENT_REQUIRED_FOR_MIXED",
        message: "Work percent is required for mixed usage.",
      });
    } else if (input.workPercent < 0 || input.workPercent > 100) {
      errors.push({
        field: "workPercent",
        code: "WORK_PERCENT_OUT_OF_RANGE",
        message: "Work percent must be between 0 and 100.",
      });
    }
  }

  if (input.warrantyMonths !== null && input.warrantyMonths < 0) {
    errors.push({
      field: "warrantyMonths",
      code: "WARRANTY_MONTHS_NEGATIVE",
      message: "Warranty months must be 0 or higher.",
    });
  }

  if (input.purchaseKind === "SUBSCRIPTION") {
    if (!input.billingCadence) {
      errors.push({
        field: "billingCadence",
        code: "BILLING_CADENCE_REQUIRED_FOR_SUBSCRIPTION",
        message: "Billing cadence is required for subscriptions.",
      });
    }

    if (input.subscriptionEndDate && input.subscriptionEndDate.trim().length > 0) {
      const endDate = input.subscriptionEndDate.trim();
      if (!isValidYmd(endDate)) {
        errors.push({
          field: "subscriptionEndDate",
          code: "SUBSCRIPTION_END_DATE_INVALID",
          message: "Subscription end date must be valid (YYYY-MM-DD).",
        });
      } else if (isValidYmd(input.purchaseDate) && compareDateStrings(endDate, input.purchaseDate) < 0) {
        errors.push({
          field: "subscriptionEndDate",
          code: "SUBSCRIPTION_END_DATE_BEFORE_START",
          message: "Subscription end date cannot be before start date.",
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    resolvedWorkPercent: resolveWorkPercent(input.usageType, input.workPercent),
  };
}
