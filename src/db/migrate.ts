import type { SQLiteExecutor } from "@/db/profile-settings-db";
import { MIGRATION_0001_INITIAL_SCHEMA } from "@/db/migrations/0001-initial-schema";
import { MIGRATION_0002_APP_LOCK_COLUMN } from "@/db/migrations/0002-app-lock";
import { MIGRATION_0003_UPLOAD_TOGGLE_COLUMN } from "@/db/migrations/0003-upload-toggle";

export async function runMigrations(db: SQLiteExecutor): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(MIGRATION_0001_INITIAL_SCHEMA);

  const appLockColumn = await db.getFirstAsync<{ existsFlag: number }>(
    `SELECT 1 AS existsFlag
     FROM pragma_table_info('ProfileSettings')
     WHERE name = 'AppLockEnabled'
     LIMIT 1;`,
    []
  );

  if (!appLockColumn) {
    await db.execAsync(MIGRATION_0002_APP_LOCK_COLUMN);
  }

  const uploadToggleColumn = await db.getFirstAsync<{ existsFlag: number }>(
    `SELECT 1 AS existsFlag
     FROM pragma_table_info('ProfileSettings')
     WHERE name = 'UploadToOneDriveAfterExport'
     LIMIT 1;`,
    []
  );

  if (!uploadToggleColumn) {
    await db.execAsync(MIGRATION_0003_UPLOAD_TOGGLE_COLUMN);
  }
}
