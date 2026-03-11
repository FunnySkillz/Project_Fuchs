import { PROFILE_SETTINGS_SINGLETON_ID, type SQLiteExecutor } from "@/db/profile-settings-db";
import {
  DEFAULT_MONTHLY_GROSS_INCOME_CENTS,
  DEFAULT_GWG_THRESHOLD_CENTS,
  DEFAULT_MARGINAL_RATE_BPS,
  DEFAULT_SALARY_PAYMENTS_PER_YEAR,
  DEFAULT_USE_MANUAL_MARGINAL_TAX_RATE,
  DEFAULT_WERBUNGSKOSTEN_PAUSCHALE_AMOUNT_CENTS,
  DEFAULT_WERBUNGSKOSTEN_PAUSCHALE_ENABLED,
  DEFAULT_WORK_PERCENT,
} from "@/models/profile-settings";

const CATEGORY_PRESET_SEED_SQL = `
INSERT OR IGNORE INTO Category (
  Id,
  Name,
  SortOrder,
  IsPreset,
  DefaultUsefulLifeMonths
) VALUES
  ('preset-laptop-computer', 'Laptop/Computer', 10, 1, 36),
  ('preset-monitor', 'Monitor', 20, 1, NULL),
  ('preset-phone', 'Phone', 30, 1, NULL),
  ('preset-office-chair', 'Office Chair', 40, 1, NULL),
  ('preset-tools', 'Tools', 50, 1, NULL),
  ('preset-other', 'Other', 60, 1, NULL);
`;

export async function runSeedData(
  db: SQLiteExecutor,
  now: Date = new Date()
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO ProfileSettings (
      Id,
      TaxYearDefault,
      MarginalRateBps,
      MonthlyGrossIncomeCents,
      SalaryPaymentsPerYear,
      UseManualMarginalTaxRate,
      ManualMarginalRateBps,
      DefaultWorkPercent,
      GwgThresholdCents,
      ApplyHalfYearRule,
      WerbungskostenPauschaleEnabled,
      WerbungskostenPauschaleAmountCents,
      AppLockEnabled,
      UploadToOneDriveAfterExport,
      ThemeModePreference,
      Currency,
      DeletedAt
    ) VALUES (
      $id,
      $taxYearDefault,
      $marginalRateBps,
      $monthlyGrossIncomeCents,
      $salaryPaymentsPerYear,
      $useManualMarginalTaxRate,
      $manualMarginalRateBps,
      $defaultWorkPercent,
      $gwgThresholdCents,
      0,
      $werbungskostenPauschaleEnabled,
      $werbungskostenPauschaleAmountCents,
      0,
      0,
      'system',
      'EUR',
      NULL
    );`,
    {
      $id: PROFILE_SETTINGS_SINGLETON_ID,
      $taxYearDefault: now.getFullYear(),
      $marginalRateBps: DEFAULT_MARGINAL_RATE_BPS,
      $monthlyGrossIncomeCents: DEFAULT_MONTHLY_GROSS_INCOME_CENTS,
      $salaryPaymentsPerYear: DEFAULT_SALARY_PAYMENTS_PER_YEAR,
      $useManualMarginalTaxRate: DEFAULT_USE_MANUAL_MARGINAL_TAX_RATE ? 1 : 0,
      $manualMarginalRateBps: DEFAULT_MARGINAL_RATE_BPS,
      $defaultWorkPercent: DEFAULT_WORK_PERCENT,
      $gwgThresholdCents: DEFAULT_GWG_THRESHOLD_CENTS,
      $werbungskostenPauschaleEnabled: DEFAULT_WERBUNGSKOSTEN_PAUSCHALE_ENABLED ? 1 : 0,
      $werbungskostenPauschaleAmountCents: DEFAULT_WERBUNGSKOSTEN_PAUSCHALE_AMOUNT_CENTS,
    }
  );

  await db.execAsync(CATEGORY_PRESET_SEED_SQL);
}
