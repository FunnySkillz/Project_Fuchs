import { validateItemInput } from "@/domain/item-validation";

describe("validateItemInput", () => {
  const baseInput = {
    title: "Work laptop",
    purchaseDate: "2026-03-10",
    totalCents: 150_000,
    usageType: "WORK" as const,
    workPercent: null,
    warrantyMonths: 24,
  };

  it("returns invalid when title is missing", () => {
    const result = validateItemInput({ ...baseInput, title: "   " });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "title",
      code: "TITLE_REQUIRED",
      message: "Title is required.",
    });
  });

  it("returns invalid when purchase date is missing/invalid", () => {
    const result = validateItemInput({ ...baseInput, purchaseDate: "" });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "purchaseDate",
      code: "PURCHASE_DATE_INVALID",
      message: "Purchase date must be valid (YYYY-MM-DD).",
    });
  });

  it("returns invalid when total cents is missing/zero/negative", () => {
    const missing = validateItemInput({ ...baseInput, totalCents: null });
    const zero = validateItemInput({ ...baseInput, totalCents: 0 });
    const negative = validateItemInput({ ...baseInput, totalCents: -100 });

    for (const result of [missing, zero, negative]) {
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "totalCents",
        code: "TOTAL_CENTS_INVALID",
        message: "Total price is required and must be greater than 0.",
      });
    }
  });

  it("returns invalid when usageType is MIXED and workPercent is null", () => {
    const result = validateItemInput({
      ...baseInput,
      usageType: "MIXED",
      workPercent: null,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "workPercent",
      code: "WORK_PERCENT_REQUIRED_FOR_MIXED",
      message: "Work percent is required for mixed usage.",
    });
  });

  it("returns valid when usageType is MIXED and workPercent is 0..100", () => {
    const atMin = validateItemInput({
      ...baseInput,
      usageType: "MIXED",
      workPercent: 0,
    });
    const atMax = validateItemInput({
      ...baseInput,
      usageType: "MIXED",
      workPercent: 100,
    });

    expect(atMin.valid).toBe(true);
    expect(atMin.errors).toEqual([]);
    expect(atMax.valid).toBe(true);
    expect(atMax.errors).toEqual([]);
  });

  it("treats usageType WORK as implicitly 100% work", () => {
    const result = validateItemInput({
      ...baseInput,
      usageType: "WORK",
      workPercent: null,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.resolvedWorkPercent).toBe(100);
  });

  it("returns invalid when warranty months is negative", () => {
    const result = validateItemInput({
      ...baseInput,
      warrantyMonths: -1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "warrantyMonths",
      code: "WARRANTY_MONTHS_NEGATIVE",
      message: "Warranty months must be 0 or higher.",
    });
  });
});
