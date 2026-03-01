import { estimateTaxImpact } from "@/domain/calculation-engine";
import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import type { Category } from "@/models/category";
import type { Item } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";

describe("estimateTaxImpact", () => {
  function expectScheduleTotal(
    scheduleByYear: Array<{ year: number; deductibleCents: number }>,
    expectedTotalCents: number
  ) {
    expect(scheduleByYear.reduce((sum, row) => sum + row.deductibleCents, 0)).toBe(expectedTotalCents);
  }

  it("PRIVATE item => deductible 0", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 150_000,
        usageType: "PRIVATE",
        workPercent: null,
        purchaseDate: "2026-04-01",
        usefulLifeMonths: 36,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: true,
        marginalRateBps: 4_000,
        defaultWorkPercent: 80,
      },
      2026
    );

    expect(result.deductibleThisYearCents).toBe(0);
    expectScheduleTotal(result.scheduleByYear, 0);
    expect(result.estimatedRefundThisYearCents).toBe(0);
    expect(result.explanations.join(" ")).toContain("resolved to 0% work share");
    expect(result.explanations.join(" ")).toContain("Deduction is 0");
  });

  it("WORK 500 EUR with threshold 1000 EUR => full deductible", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 50_000,
        usageType: "WORK",
        workPercent: null,
        purchaseDate: "2026-02-15",
        usefulLifeMonths: 36,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: false,
        marginalRateBps: 4_000,
        defaultWorkPercent: 100,
      },
      2026
    );

    expect(result.deductibleThisYearCents).toBe(50_000);
    expectScheduleTotal(result.scheduleByYear, 50_000);
    expect(result.estimatedRefundThisYearCents).toBe(20_000);
    expect(result.explanations.join(" ")).toContain("below/equal GWG threshold");
    expect(result.explanations.join(" ")).toContain("Tax year 2026: deductible 50000 cents.");
  });

  it("MIXED 999.99 EUR with 70% work and threshold 1000 EUR => full in year", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 99_999,
        usageType: "MIXED",
        workPercent: 70,
        purchaseDate: "2026-05-20",
        usefulLifeMonths: 36,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: false,
        marginalRateBps: 3_000,
        defaultWorkPercent: 80,
      },
      2026
    );

    expect(result.deductibleThisYearCents).toBe(69_999);
    expectScheduleTotal(result.scheduleByYear, 69_999);
    expect(result.estimatedRefundThisYearCents).toBe(21_000);
    expect(result.explanations.join(" ")).toContain("resolved to 70% work share");
    expect(result.explanations.join(" ")).toContain("below/equal GWG threshold");
  });

  it("MIXED 1500 EUR with 70% work and usefulLife 36 => schedule across 3 years", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 150_000,
        usageType: "MIXED",
        workPercent: 70,
        purchaseDate: "2026-03-10",
        usefulLifeMonths: 36,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: false,
        marginalRateBps: 4_000,
        defaultWorkPercent: 100,
      },
      2026
    );

    expect(result.scheduleByYear).toEqual([
      { year: 2026, deductibleCents: 35_000 },
      { year: 2027, deductibleCents: 35_000 },
      { year: 2028, deductibleCents: 35_000 },
    ]);
    expect(result.deductibleThisYearCents).toBe(35_000);
    expectScheduleTotal(result.scheduleByYear, 105_000);
    expect(result.estimatedRefundThisYearCents).toBe(14_000);
    expect(result.explanations.join(" ")).toContain("above GWG threshold");
    expect(result.explanations.join(" ")).toContain("Half-year rule disabled.");
  });

  it("Half-year rule after 30 June => lower first-year portion", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 150_000,
        usageType: "MIXED",
        workPercent: 70,
        purchaseDate: "2026-07-05",
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
      { year: 2026, deductibleCents: 26_250 },
      { year: 2027, deductibleCents: 52_500 },
      { year: 2028, deductibleCents: 26_250 },
    ]);
    expect(result.deductibleThisYearCents).toBe(26_250);
    expectScheduleTotal(result.scheduleByYear, 105_000);
    expect(result.estimatedRefundThisYearCents).toBe(10_500);
    expect(result.scheduleByYear[0].deductibleCents).toBeLessThan(result.scheduleByYear[1].deductibleCents);
    expect(result.explanations.join(" ")).toContain("Half-year rule active and purchase after 30 June");
  });

  it("Marginal rate impact => deductibleThisYear * rateBps / 10000", () => {
    const result = estimateTaxImpact(
      {
        totalCents: 60_000,
        usageType: "WORK",
        workPercent: null,
        purchaseDate: "2026-01-15",
        usefulLifeMonths: 12,
      },
      {
        gwgThresholdCents: 100_000,
        applyHalfYearRule: false,
        marginalRateBps: 4_200,
        defaultWorkPercent: 100,
      },
      2026
    );

    expect(result.deductibleThisYearCents).toBe(60_000);
    expectScheduleTotal(result.scheduleByYear, 60_000);
    expect(result.estimatedRefundThisYearCents).toBe(25_200);
    expect(result.explanations.join(" ")).toContain("marginal rate 4200 bps");
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
    themeModePreference: "system",
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
