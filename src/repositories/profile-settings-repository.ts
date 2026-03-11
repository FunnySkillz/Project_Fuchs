import type { ProfileSettings } from "@/models/profile-settings";
import { createDefaultProfileSettings } from "@/models/profile-settings";
import { normalizeProfileSettings } from "@/domain/profile-settings";
import { PROFILE_SETTINGS_SINGLETON_ID, type SQLiteExecutor } from "@/db/profile-settings-db";
import { isThemeMode } from "@/theme/theme-mode";

interface ProfileSettingsRow {
  taxYearDefault: number;
  marginalRateBps: number;
  monthlyGrossIncomeCents: number;
  salaryPaymentsPerYear: number;
  useManualMarginalTaxRate: number;
  manualMarginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: number;
  werbungskostenPauschaleEnabled: number;
  werbungskostenPauschaleAmountCents: number;
  appLockEnabled: number;
  uploadToOneDriveAfterExport: number;
  themeModePreference: string;
  currency: string;
}

export interface ProfileSettingsRepository {
  hasSettings(): Promise<boolean>;
  hasValidSettings(): Promise<boolean>;
  getSettings(): Promise<ProfileSettings>;
  upsertSettings(settings: Partial<ProfileSettings>): Promise<ProfileSettings>;
}

export class SQLiteProfileSettingsRepository implements ProfileSettingsRepository {
  constructor(
    private readonly db: SQLiteExecutor,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async hasSettings(): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ existsFlag: number }>(
      `SELECT 1 AS existsFlag
      FROM ProfileSettings
      WHERE Id = $id AND DeletedAt IS NULL
      LIMIT 1;`,
      { $id: PROFILE_SETTINGS_SINGLETON_ID }
    );

    return row?.existsFlag === 1;
  }

  async hasValidSettings(): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ validFlag: number }>(
      `SELECT 1 AS validFlag
      FROM ProfileSettings
      WHERE Id = $id
        AND DeletedAt IS NULL
        AND TaxYearDefault BETWEEN 2000 AND 2100
        AND MarginalRateBps BETWEEN 0 AND 10000
        AND MonthlyGrossIncomeCents >= 0
        AND SalaryPaymentsPerYear IN (12, 14)
        AND UseManualMarginalTaxRate IN (0, 1)
        AND ManualMarginalRateBps BETWEEN 0 AND 10000
        AND DefaultWorkPercent BETWEEN 0 AND 100
        AND GwgThresholdCents >= 0
        AND ApplyHalfYearRule IN (0, 1)
        AND WerbungskostenPauschaleEnabled IN (0, 1)
        AND WerbungskostenPauschaleAmountCents >= 0
        AND AppLockEnabled IN (0, 1)
        AND UploadToOneDriveAfterExport IN (0, 1)
        AND ThemeModePreference IN ('system', 'light', 'dark')
        AND Currency = 'EUR'
      LIMIT 1;`,
      { $id: PROFILE_SETTINGS_SINGLETON_ID }
    );

    return row?.validFlag === 1;
  }

  async getSettings(): Promise<ProfileSettings> {
    const row = await this.db.getFirstAsync<ProfileSettingsRow>(
      `SELECT
        TaxYearDefault AS taxYearDefault,
        MarginalRateBps AS marginalRateBps,
        MonthlyGrossIncomeCents AS monthlyGrossIncomeCents,
        SalaryPaymentsPerYear AS salaryPaymentsPerYear,
        UseManualMarginalTaxRate AS useManualMarginalTaxRate,
        ManualMarginalRateBps AS manualMarginalRateBps,
        DefaultWorkPercent AS defaultWorkPercent,
        GwgThresholdCents AS gwgThresholdCents,
        ApplyHalfYearRule AS applyHalfYearRule,
        WerbungskostenPauschaleEnabled AS werbungskostenPauschaleEnabled,
        WerbungskostenPauschaleAmountCents AS werbungskostenPauschaleAmountCents,
        AppLockEnabled AS appLockEnabled,
        UploadToOneDriveAfterExport AS uploadToOneDriveAfterExport,
        ThemeModePreference AS themeModePreference,
        Currency AS currency
      FROM ProfileSettings
      WHERE Id = $id AND DeletedAt IS NULL
      LIMIT 1;`,
      { $id: PROFILE_SETTINGS_SINGLETON_ID }
    );

    if (!row) {
      const defaults = createDefaultProfileSettings(this.nowProvider());
      await this.writeSettings(defaults);
      return defaults;
    }

    return normalizeProfileSettings({
      taxYearDefault: row.taxYearDefault,
      marginalRateBps: row.marginalRateBps,
      monthlyGrossIncomeCents: row.monthlyGrossIncomeCents,
      salaryPaymentsPerYear:
        row.salaryPaymentsPerYear === 12 || row.salaryPaymentsPerYear === 14
          ? row.salaryPaymentsPerYear
          : undefined,
      useManualMarginalTaxRate: row.useManualMarginalTaxRate === 1,
      manualMarginalRateBps: row.manualMarginalRateBps,
      defaultWorkPercent: row.defaultWorkPercent,
      gwgThresholdCents: row.gwgThresholdCents,
      applyHalfYearRule: row.applyHalfYearRule === 1,
      werbungskostenPauschaleEnabled: row.werbungskostenPauschaleEnabled === 1,
      werbungskostenPauschaleAmountCents: row.werbungskostenPauschaleAmountCents,
      appLockEnabled: row.appLockEnabled === 1,
      uploadToOneDriveAfterExport: row.uploadToOneDriveAfterExport === 1,
      themeModePreference: isThemeMode(row.themeModePreference)
        ? row.themeModePreference
        : undefined,
      currency: row.currency === "EUR" ? "EUR" : "EUR",
    });
  }

  async upsertSettings(settings: Partial<ProfileSettings>): Promise<ProfileSettings> {
    const existing = await this.getSettings();
    const merged = normalizeProfileSettings(settings, existing);
    await this.writeSettings(merged);
    return merged;
  }

  private async writeSettings(settings: ProfileSettings): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO ProfileSettings (
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
      ) VALUES ($id, $taxYearDefault, $marginalRateBps, $monthlyGrossIncomeCents, $salaryPaymentsPerYear, $useManualMarginalTaxRate, $manualMarginalRateBps, $defaultWorkPercent, $gwgThresholdCents, $applyHalfYearRule, $werbungskostenPauschaleEnabled, $werbungskostenPauschaleAmountCents, $appLockEnabled, $uploadToOneDriveAfterExport, $themeModePreference, $currency, NULL)
      ON CONFLICT(Id) DO UPDATE SET
        TaxYearDefault = excluded.TaxYearDefault,
        MarginalRateBps = excluded.MarginalRateBps,
        MonthlyGrossIncomeCents = excluded.MonthlyGrossIncomeCents,
        SalaryPaymentsPerYear = excluded.SalaryPaymentsPerYear,
        UseManualMarginalTaxRate = excluded.UseManualMarginalTaxRate,
        ManualMarginalRateBps = excluded.ManualMarginalRateBps,
        DefaultWorkPercent = excluded.DefaultWorkPercent,
        GwgThresholdCents = excluded.GwgThresholdCents,
        ApplyHalfYearRule = excluded.ApplyHalfYearRule,
        WerbungskostenPauschaleEnabled = excluded.WerbungskostenPauschaleEnabled,
        WerbungskostenPauschaleAmountCents = excluded.WerbungskostenPauschaleAmountCents,
        AppLockEnabled = excluded.AppLockEnabled,
        UploadToOneDriveAfterExport = excluded.UploadToOneDriveAfterExport,
        ThemeModePreference = excluded.ThemeModePreference,
        Currency = excluded.Currency,
        DeletedAt = NULL;`,
      {
        $id: PROFILE_SETTINGS_SINGLETON_ID,
        $taxYearDefault: settings.taxYearDefault,
        $marginalRateBps: settings.marginalRateBps,
        $monthlyGrossIncomeCents: settings.monthlyGrossIncomeCents,
        $salaryPaymentsPerYear: settings.salaryPaymentsPerYear,
        $useManualMarginalTaxRate: settings.useManualMarginalTaxRate ? 1 : 0,
        $manualMarginalRateBps: settings.manualMarginalRateBps,
        $defaultWorkPercent: settings.defaultWorkPercent,
        $gwgThresholdCents: settings.gwgThresholdCents,
        $applyHalfYearRule: settings.applyHalfYearRule ? 1 : 0,
        $werbungskostenPauschaleEnabled: settings.werbungskostenPauschaleEnabled ? 1 : 0,
        $werbungskostenPauschaleAmountCents: settings.werbungskostenPauschaleAmountCents,
        $appLockEnabled: settings.appLockEnabled ? 1 : 0,
        $uploadToOneDriveAfterExport: settings.uploadToOneDriveAfterExport ? 1 : 0,
        $themeModePreference: settings.themeModePreference,
        $currency: settings.currency,
      }
    );
  }
}
