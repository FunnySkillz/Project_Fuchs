import { estimateTaxImpact } from "@/domain/calculation-engine";
import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import type { Category } from "@/models/category";
import type { Item } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";

describe("estimateTaxImpact", () => {
  it("applies immediate deduction when deductible base is below threshold", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 100_000,
        usageType: "MIXED",
        workPercent: 50,
        purchaseDate: "2026-03-10",
        usefulLifeMonths: 36,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: false,
        marginalRateBps: 4_000,
        defaultWorkPercent: 80,
      },
      2026
    );

    expect(result.scheduleByYear).toEqual([{ year: 2026, deductibleCents: 50_000 }]);
    expect(result.deductibleThisYearCents).toBe(50_000);
    expect(result.estimatedRefundThisYearCents).toBe(20_000);
    expect(result.explanations.join(" ")).toContain("Deductible base");
  });

  it("uses default work percent for mixed usage when workPercent is null", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 200_000,
        usageType: "MIXED",
        workPercent: null,
        purchaseDate: "2026-01-01",
        usefulLifeMonths: 36,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: false,
        marginalRateBps: 5_000,
        defaultWorkPercent: 60,
      },
      2026
    );

    expect(result.scheduleByYear).toEqual([
      { year: 2026, deductibleCents: 40_000 },
      { year: 2027, deductibleCents: 40_000 },
      { year: 2028, deductibleCents: 40_000 },
    ]);
    expect(result.deductibleThisYearCents).toBe(40_000);
    expect(result.estimatedRefundThisYearCents).toBe(20_000);
  });

  it("returns zero deductible for private usage", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 999_999,
        usageType: "PRIVATE",
        workPercent: null,
        purchaseDate: "2026-05-15",
        usefulLifeMonths: 36,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: true,
        marginalRateBps: 4_000,
        defaultWorkPercent: 100,
      },
      2026
    );

    expect(result.scheduleByYear).toEqual([]);
    expect(result.deductibleThisYearCents).toBe(0);
    expect(result.estimatedRefundThisYearCents).toBe(0);
  });

  it("applies half-year rule for purchases after June when above threshold", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 240_000,
        usageType: "WORK",
        workPercent: null,
        purchaseDate: "2026-07-01",
        usefulLifeMonths: 24,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: true,
        marginalRateBps: 4_000,
        defaultWorkPercent: 100,
      },
      2026
    );

    expect(result.scheduleByYear).toEqual([
      { year: 2026, deductibleCents: 60_000 },
      { year: 2027, deductibleCents: 120_000 },
      { year: 2028, deductibleCents: 60_000 },
    ]);
    expect(result.scheduleByYear.reduce((sum, row) => sum + row.deductibleCents, 0)).toBe(240_000);
    expect(result.explanations.join(" ")).toContain("Half-year rule active");
  });

  it("throws on invalid purchase date", () => {
    expect(() =>
      estimateTaxImpact(
        {
          totalCents: 100_000,
          usageType: "WORK",
          workPercent: null,
          purchaseDate: "2026-13-01",
          usefulLifeMonths: 36,
        },
        {
          gwgThresholdCents: 100_000,
          applyHalfYearRule: false,
          marginalRateBps: 4_000,
          defaultWorkPercent: 100,
        },
        2026
      )
    ).toThrow("Invalid purchaseDate value");
  });
});

describe("computeDeductibleImpactCents", () => {
  const baseSettings: ProfileSettings = {
    taxYearDefault: 2026,
    marginalRateBps: 4_000,
    defaultWorkPercent: 100,
    gwgThresholdCents: 100_000,
    applyHalfYearRule: false,
    appLockEnabled: false,
    uploadToOneDriveAfterExport: false,
    currency: "EUR",
  };

  const baseItem: Item = {
    id: "item-1",
    title: "Laptop",
    purchaseDate: "2026-01-01",
    totalCents: 360_000,
    currency: "EUR",
    usageType: "WORK",
    workPercent: null,
    categoryId: "cat-laptop",
    vendor: null,
    warrantyMonths: null,
    notes: null,
    usefulLifeMonthsOverride: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };

  it("uses category default useful life when available", () => {
    const categories = new Map<string, Category>([
      [
        "cat-laptop",
        {
          id: "cat-laptop",
          name: "Laptop",
          sortOrder: 0,
          isPreset: true,
          defaultUsefulLifeMonths: 36,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    ]);

    const deductible = computeDeductibleImpactCents(baseItem, baseSettings, categories, 2026);
    expect(deductible).toBe(120_000);
  });

  it("uses useful-life override when set on item", () => {
    const categories = new Map<string, Category>([
      [
        "cat-laptop",
        {
          id: "cat-laptop",
          name: "Laptop",
          sortOrder: 0,
          isPreset: true,
          defaultUsefulLifeMonths: 36,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    ]);

    const deductible = computeDeductibleImpactCents(
      { ...baseItem, usefulLifeMonthsOverride: 12 },
      baseSettings,
      categories,
      2026
    );
    expect(deductible).toBe(360_000);
  });

  it("falls back to 36 months when no category default and no override", () => {
    const deductible = computeDeductibleImpactCents(
      { ...baseItem, categoryId: "missing" },
      baseSettings,
      new Map<string, Category>(),
      2026
    );
    expect(deductible).toBe(120_000);
  });
});
