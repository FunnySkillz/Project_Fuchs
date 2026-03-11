import { estimateAustrianMarginalRateBpsFromAnnualGrossCents } from "@/domain/austrian-marginal-rate";

describe("estimateAustrianMarginalRateBpsFromAnnualGrossCents", () => {
  it("uses matching year table when supported", () => {
    const result = estimateAustrianMarginalRateBpsFromAnnualGrossCents(4_200_000, 2026);
    expect(result.usedTaxYear).toBe(2026);
    expect(result.marginalRateBps).toBe(4_000);
  });

  it("falls back deterministically to nearest supported year", () => {
    const result = estimateAustrianMarginalRateBpsFromAnnualGrossCents(4_200_000, 2030);
    expect(result.usedTaxYear).toBe(2026);
    expect(result.marginalRateBps).toBe(4_000);
  });

  it("sanitizes invalid annual gross to zero", () => {
    const result = estimateAustrianMarginalRateBpsFromAnnualGrossCents(Number.NaN, 2026);
    expect(result.annualGrossCents).toBe(0);
    expect(result.marginalRateBps).toBe(0);
  });
});
