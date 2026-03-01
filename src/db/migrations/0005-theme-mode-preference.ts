import type { SQLiteExecutor } from "@/db/profile-settings-db";

interface TableColumnInfo {
  name: string;
}

export async function applyMigration0005ThemeModePreference(
  db: SQLiteExecutor
): Promise<void> {
  const columns = await db.getAllAsync<TableColumnInfo>(
    "PRAGMA table_info('ProfileSettings');",
    []
  );

  const hasThemeModeColumn = columns.some((column) => column.name === "ThemeModePreference");
  if (!hasThemeModeColumn) {
    await db.execAsync(
      "ALTER TABLE ProfileSettings ADD COLUMN ThemeModePreference TEXT NOT NULL DEFAULT 'system';"
    );
  }

  await db.runAsync(
    `UPDATE ProfileSettings
     SET ThemeModePreference = 'system'
     WHERE ThemeModePreference IS NULL
        OR ThemeModePreference NOT IN ('system', 'light', 'dark');`,
    []
  );
}
