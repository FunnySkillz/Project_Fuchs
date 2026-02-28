export type SQLiteBindValue = string | number | null;
export type SQLiteBindParams = SQLiteBindValue[] | Record<string, SQLiteBindValue>;

export interface SQLiteExecutor {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>;
  runAsync(source: string, params: SQLiteBindParams): Promise<unknown>;
}

export async function ensureProfileSettingsTable(db: SQLiteExecutor): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profile_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tax_year_default INTEGER NOT NULL,
      marginal_rate REAL NOT NULL,
      default_work_percent REAL NOT NULL,
      gwg_threshold INTEGER NOT NULL,
      apply_half_year_rule INTEGER NOT NULL CHECK (apply_half_year_rule IN (0, 1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
