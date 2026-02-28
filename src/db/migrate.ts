import type { SQLiteExecutor } from "@/db/profile-settings-db";
import { MIGRATION_0001_INITIAL_SCHEMA } from "@/db/migrations/0001-initial-schema";

export async function runMigrations(db: SQLiteExecutor): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(MIGRATION_0001_INITIAL_SCHEMA);
}
