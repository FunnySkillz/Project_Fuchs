export interface AustrianMarginalRateBracket {
  upToAnnualGrossCents: number | null;
  marginalRateBps: number;
}

export interface AustrianMarginalRateEstimate {
  annualGrossCents: number;
  requestedTaxYear: number;
  usedTaxYear: number;
  marginalRateBps: number;
}

const AUSTRIAN_MARGINAL_RATE_TABLES: Record<number, readonly AustrianMarginalRateBracket[]> = {
  2024: [
    { upToAnnualGrossCents: 1_281_600, marginalRateBps: 0 },
    { upToAnnualGrossCents: 2_081_800, marginalRateBps: 2_000 },
    { upToAnnualGrossCents: 3_451_300, marginalRateBps: 3_000 },
    { upToAnnualGrossCents: 6_661_200, marginalRateBps: 4_000 },
    { upToAnnualGrossCents: 9_926_600, marginalRateBps: 4_800 },
    { upToAnnualGrossCents: 100_000_000, marginalRateBps: 5_000 },
    { upToAnnualGrossCents: null, marginalRateBps: 5_500 },
  ],
  2025: [
    { upToAnnualGrossCents: 1_281_600, marginalRateBps: 0 },
    { upToAnnualGrossCents: 2_081_800, marginalRateBps: 2_000 },
    { upToAnnualGrossCents: 3_451_300, marginalRateBps: 3_000 },
    { upToAnnualGrossCents: 6_661_200, marginalRateBps: 4_000 },
    { upToAnnualGrossCents: 9_926_600, marginalRateBps: 4_800 },
    { upToAnnualGrossCents: 100_000_000, marginalRateBps: 5_000 },
    { upToAnnualGrossCents: null, marginalRateBps: 5_500 },
  ],
  2026: [
    { upToAnnualGrossCents: 1_281_600, marginalRateBps: 0 },
    { upToAnnualGrossCents: 2_081_800, marginalRateBps: 2_000 },
    { upToAnnualGrossCents: 3_451_300, marginalRateBps: 3_000 },
    { upToAnnualGrossCents: 6_661_200, marginalRateBps: 4_000 },
    { upToAnnualGrossCents: 9_926_600, marginalRateBps: 4_800 },
    { upToAnnualGrossCents: 100_000_000, marginalRateBps: 5_000 },
    { upToAnnualGrossCents: null, marginalRateBps: 5_500 },
  ],
};

function sanitizeAnnualGrossCents(input: number): number {
  if (!Number.isFinite(input)) {
    return 0;
  }
  return Math.max(0, Math.round(input));
}

function nearestSupportedYear(taxYear: number): number {
  const supportedYears = Object.keys(AUSTRIAN_MARGINAL_RATE_TABLES)
    .map((value) => Number.parseInt(value, 10))
    .sort((left, right) => left - right);
  if (supportedYears.length === 0) {
    return taxYear;
  }

  let nearest = supportedYears[0];
  let smallestDistance = Math.abs(taxYear - nearest);

  for (let index = 1; index < supportedYears.length; index += 1) {
    const candidate = supportedYears[index];
    const distance = Math.abs(taxYear - candidate);
    if (distance < smallestDistance) {
      nearest = candidate;
      smallestDistance = distance;
    }
  }

  return nearest;
}

function resolveMarginalRateFromBrackets(
  annualGrossCents: number,
  brackets: readonly AustrianMarginalRateBracket[]
): number {
  for (const bracket of brackets) {
    if (bracket.upToAnnualGrossCents === null) {
      return bracket.marginalRateBps;
    }
    if (annualGrossCents <= bracket.upToAnnualGrossCents) {
      return bracket.marginalRateBps;
    }
  }
  return 0;
}

export function estimateAustrianMarginalRateBpsFromAnnualGrossCents(
  annualGrossCentsInput: number,
  taxYearInput: number
): AustrianMarginalRateEstimate {
  const annualGrossCents = sanitizeAnnualGrossCents(annualGrossCentsInput);
  const requestedTaxYear = Number.isFinite(taxYearInput)
    ? Math.round(taxYearInput)
    : new Date().getFullYear();
  const usedTaxYear = nearestSupportedYear(requestedTaxYear);
  const brackets = AUSTRIAN_MARGINAL_RATE_TABLES[usedTaxYear] ?? AUSTRIAN_MARGINAL_RATE_TABLES[2026];

  return {
    annualGrossCents,
    requestedTaxYear,
    usedTaxYear,
    marginalRateBps: resolveMarginalRateFromBrackets(annualGrossCents, brackets),
  };
}
