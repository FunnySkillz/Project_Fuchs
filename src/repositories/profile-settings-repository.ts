import type { ProfileSettings } from "@/models/profile-settings";
import { createDefaultProfileSettings } from "@/models/profile-settings";
import { normalizeProfileSettings } from "@/domain/profile-settings";
import { ensureProfileSettingsTable, type SQLiteExecutor } from "@/db/profile-settings-db";

interface ProfileSettingsRow {
  taxYearDefault: number;
  marginalRate: number;
  defaultWorkPercent: number;
  gwgThreshold: number;
  applyHalfYearRule: number;
}

export interface ProfileSettingsRepository {
  getSettings(): Promise<ProfileSettings>;
  upsertSettings(settings: Partial<ProfileSettings>): Promise<ProfileSettings>;
}

export class SQLiteProfileSettingsRepository implements ProfileSettingsRepository {
  private initialized = false;

  constructor(
    private readonly db: SQLiteExecutor,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async getSettings(): Promise<ProfileSettings> {
    await this.ensureInitialized();

    const row = await this.db.getFirstAsync<ProfileSettingsRow>(
      `SELECT
        tax_year_default AS taxYearDefault,
        marginal_rate AS marginalRate,
        default_work_percent AS defaultWorkPercent,
        gwg_threshold AS gwgThreshold,
        apply_half_year_rule AS applyHalfYearRule
      FROM profile_settings
      WHERE id = 1
      LIMIT 1;`,
      []
    );

    if (!row) {
      const defaults = createDefaultProfileSettings(this.nowProvider());
      await this.writeSettings(defaults);
      return defaults;
    }

    return normalizeProfileSettings({
      taxYearDefault: row.taxYearDefault,
      marginalRate: row.marginalRate,
      defaultWorkPercent: row.defaultWorkPercent,
      gwgThreshold: row.gwgThreshold,
      applyHalfYearRule: row.applyHalfYearRule === 1,
    });
  }

  async upsertSettings(settings: Partial<ProfileSettings>): Promise<ProfileSettings> {
    const existing = await this.getSettings();
    const merged = normalizeProfileSettings(settings, existing);
    await this.writeSettings(merged);
    return merged;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await ensureProfileSettingsTable(this.db);
    this.initialized = true;
  }

  private async writeSettings(settings: ProfileSettings): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO profile_settings (
        id,
        tax_year_default,
        marginal_rate,
        default_work_percent,
        gwg_threshold,
        apply_half_year_rule
      ) VALUES (1, $taxYearDefault, $marginalRate, $defaultWorkPercent, $gwgThreshold, $applyHalfYearRule)
      ON CONFLICT(id) DO UPDATE SET
        tax_year_default = excluded.tax_year_default,
        marginal_rate = excluded.marginal_rate,
        default_work_percent = excluded.default_work_percent,
        gwg_threshold = excluded.gwg_threshold,
        apply_half_year_rule = excluded.apply_half_year_rule,
        updated_at = CURRENT_TIMESTAMP;`,
      {
        $taxYearDefault: settings.taxYearDefault,
        $marginalRate: settings.marginalRate,
        $defaultWorkPercent: settings.defaultWorkPercent,
        $gwgThreshold: settings.gwgThreshold,
        $applyHalfYearRule: settings.applyHalfYearRule ? 1 : 0,
      }
    );
  }
}
