import type { SQLiteExecutor } from "@/db/profile-settings-db";

interface TableColumnInfo {
  name: string;
}

export async function applyMigration0007LanguagePreference(
  db: SQLiteExecutor
): Promise<void> {
  const columns = await db.getAllAsync<TableColumnInfo>(
    "PRAGMA table_info('ProfileSettings');",
    []
  );
  const hasLanguagePreferenceColumn = columns.some(
    (column) => column.name === "LanguagePreference"
  );

  if (!hasLanguagePreferenceColumn) {
    await db.execAsync(
      "ALTER TABLE ProfileSettings ADD COLUMN LanguagePreference TEXT NULL;"
    );
  }

  await db.runAsync(
    `UPDATE ProfileSettings
     SET LanguagePreference = NULL
     WHERE LanguagePreference IS NOT NULL
       AND LanguagePreference NOT IN ('en', 'de');`,
    []
  );
}
