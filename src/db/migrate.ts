import type { SQLiteExecutor } from "@/db/profile-settings-db";
import { DB_MIGRATIONS } from "@/db/migrations";

const MIGRATION_META_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO schema_migrations (id, version)
VALUES (1, 0)
ON CONFLICT(id) DO NOTHING;
`;

interface MigrationVersionRow {
  version: number;
}

export class MigrationError extends Error {
  constructor(message: string, public readonly migrationVersion?: number) {
    super(message);
    this.name = "MigrationError";
  }
}

async function getCurrentSchemaVersion(db: SQLiteExecutor): Promise<number> {
  const row = await db.getFirstAsync<MigrationVersionRow>(
    `SELECT version
     FROM schema_migrations
     WHERE id = 1
     LIMIT 1;`,
    []
  );
  return row?.version ?? 0;
}

async function setCurrentSchemaVersion(db: SQLiteExecutor, version: number): Promise<void> {
  await db.runAsync(
    `UPDATE schema_migrations
     SET version = $version,
         updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     WHERE id = 1;`,
    { $version: version }
  );
}

export async function runMigrations(db: SQLiteExecutor): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(MIGRATION_META_TABLE_SQL);

  const currentVersion = await getCurrentSchemaVersion(db);
  const pending = DB_MIGRATIONS.filter((migration) => migration.version > currentVersion);

  for (const migration of pending) {
    try {
      await db.execAsync("BEGIN TRANSACTION;");
      await migration.up(db);
      await setCurrentSchemaVersion(db, migration.version);
      await db.execAsync("COMMIT;");
    } catch (error) {
      await db.execAsync("ROLLBACK;");
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new MigrationError(
        `Database migration ${migration.version} (${migration.name}) failed: ${reason}`,
        migration.version
      );
    }
  }
}
