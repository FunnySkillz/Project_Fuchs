import type { ItemUsageType } from "@/models/item";
import { isValidYmd } from "@/utils/date";

export type ItemValidationField =
  | "title"
  | "purchaseDate"
  | "totalCents"
  | "workPercent"
  | "warrantyMonths";

export type ItemValidationCode =
  | "TITLE_REQUIRED"
  | "PURCHASE_DATE_INVALID"
  | "TOTAL_CENTS_INVALID"
  | "WORK_PERCENT_REQUIRED_FOR_MIXED"
  | "WORK_PERCENT_OUT_OF_RANGE"
  | "WARRANTY_MONTHS_NEGATIVE";

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
}

export interface ItemValidationResult {
  valid: boolean;
  errors: ItemValidationError[];
  resolvedWorkPercent: number;
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

  return {
    valid: errors.length === 0,
    errors,
    resolvedWorkPercent: resolveWorkPercent(input.usageType, input.workPercent),
  };
}
