import type { ProfileSettings } from "@/models/profile-settings";
import { createDefaultProfileSettings } from "@/models/profile-settings";
import { normalizeProfileSettings } from "@/domain/profile-settings";
import { PROFILE_SETTINGS_SINGLETON_ID, type SQLiteExecutor } from "@/db/profile-settings-db";

interface ProfileSettingsRow {
  taxYearDefault: number;
  marginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: number;
  appLockEnabled: number;
  uploadToOneDriveAfterExport: number;
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
        AND DefaultWorkPercent BETWEEN 0 AND 100
        AND GwgThresholdCents >= 0
        AND ApplyHalfYearRule IN (0, 1)
        AND AppLockEnabled IN (0, 1)
        AND UploadToOneDriveAfterExport IN (0, 1)
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
        DefaultWorkPercent AS defaultWorkPercent,
        GwgThresholdCents AS gwgThresholdCents,
        ApplyHalfYearRule AS applyHalfYearRule,
        AppLockEnabled AS appLockEnabled,
        UploadToOneDriveAfterExport AS uploadToOneDriveAfterExport,
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
      defaultWorkPercent: row.defaultWorkPercent,
      gwgThresholdCents: row.gwgThresholdCents,
      applyHalfYearRule: row.applyHalfYearRule === 1,
      appLockEnabled: row.appLockEnabled === 1,
      uploadToOneDriveAfterExport: row.uploadToOneDriveAfterExport === 1,
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
        DefaultWorkPercent,
        GwgThresholdCents,
        ApplyHalfYearRule,
        AppLockEnabled,
        UploadToOneDriveAfterExport,
        Currency,
        DeletedAt
      ) VALUES ($id, $taxYearDefault, $marginalRateBps, $defaultWorkPercent, $gwgThresholdCents, $applyHalfYearRule, $appLockEnabled, $uploadToOneDriveAfterExport, $currency, NULL)
      ON CONFLICT(Id) DO UPDATE SET
        TaxYearDefault = excluded.TaxYearDefault,
        MarginalRateBps = excluded.MarginalRateBps,
        DefaultWorkPercent = excluded.DefaultWorkPercent,
        GwgThresholdCents = excluded.GwgThresholdCents,
        ApplyHalfYearRule = excluded.ApplyHalfYearRule,
        AppLockEnabled = excluded.AppLockEnabled,
        UploadToOneDriveAfterExport = excluded.UploadToOneDriveAfterExport,
        Currency = excluded.Currency,
        DeletedAt = NULL;`,
      {
        $id: PROFILE_SETTINGS_SINGLETON_ID,
        $taxYearDefault: settings.taxYearDefault,
        $marginalRateBps: settings.marginalRateBps,
        $defaultWorkPercent: settings.defaultWorkPercent,
        $gwgThresholdCents: settings.gwgThresholdCents,
        $applyHalfYearRule: settings.applyHalfYearRule ? 1 : 0,
        $appLockEnabled: settings.appLockEnabled ? 1 : 0,
        $uploadToOneDriveAfterExport: settings.uploadToOneDriveAfterExport ? 1 : 0,
        $currency: settings.currency,
      }
    );
  }
}
