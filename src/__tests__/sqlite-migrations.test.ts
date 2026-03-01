import { MigrationError, runMigrations } from "@/db/migrate";
import { DB_MIGRATIONS } from "@/db/migrations";
import type { DbMigration } from "@/db/migrations/types";
import { withTempSqliteExecutor } from "@/__tests__/helpers/sqlite-test-utils";
import type { SQLiteBindParams, SQLiteExecutor } from "@/db/profile-settings-db";

interface SqliteMasterRow {
  type: "table" | "index" | "trigger";
  name: string;
}

describe("runMigrations integration", () => {
  it("creates schema tables, indexes, triggers, and enables foreign keys on fresh DB", async () => {
    await withTempSqliteExecutor(async (db) => {
      await runMigrations(db);

      const objects = await db.getAllAsync<SqliteMasterRow>(
        `SELECT type, name
         FROM sqlite_master
         WHERE type IN ('table', 'index', 'trigger')`,
        []
      );
      const names = new Set(objects.map((row) => row.name));

      expect(Array.from(names)).toEqual(
        expect.arrayContaining([
          "schema_migrations",
          "ProfileSettings",
          "Category",
          "Item",
          "Attachment",
          "ExportRun",
          "UX_Category_Name_NotDeleted",
          "IX_Category_SortOrder",
          "IX_Item_PurchaseDate",
          "IX_Item_CategoryId",
          "IX_Item_UsageType",
          "IX_Item_NotDeleted",
          "IX_Attachment_ItemId",
          "IX_Attachment_NotDeleted",
          "IX_ExportRun_TaxYear",
          "TR_ProfileSettings_UpdatedAt",
          "TR_Category_UpdatedAt",
          "TR_Item_UpdatedAt",
          "TR_Attachment_UpdatedAt",
          "TR_ExportRun_UpdatedAt",
        ])
      );

      const foreignKeys = await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;", []);
      expect(foreignKeys?.foreign_keys).toBe(1);
    });
  });

  it("returns MigrationError with migration version when a migration fails", async () => {
    const failingMigration: DbMigration = {
      version: 99_999,
      name: "test-failing-migration",
      up: async (db) => {
        await db.execAsync("THIS IS INVALID SQL;");
      },
    };

    DB_MIGRATIONS.push(failingMigration);
    try {
      await withTempSqliteExecutor(async (db) => {
        let thrown: unknown;
        try {
          await runMigrations(db);
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(MigrationError);
        expect(thrown).toMatchObject({
          name: "MigrationError",
          migrationVersion: failingMigration.version,
          details: {
            code: "MIGRATION_EXECUTION_FAILED",
            migrationVersion: failingMigration.version,
            migrationName: failingMigration.name,
          },
        });
      });
    } finally {
      const index = DB_MIGRATIONS.findIndex((migration) => migration.version === failingMigration.version);
      if (index >= 0) {
        DB_MIGRATIONS.splice(index, 1);
      }
    }
  });

  it("returns structured MigrationError when migration metadata initialization fails", async () => {
    const failingExecutor: SQLiteExecutor = {
      async execAsync(source: string) {
        if (source.includes("schema_migrations")) {
          throw new Error("meta init failed");
        }
      },
      async getFirstAsync<T>() {
        return { version: 0 } as T;
      },
      async getAllAsync<T>() {
        return [] as T[];
      },
      async runAsync() {
        return {};
      },
    };

    await expect(runMigrations(failingExecutor)).rejects.toMatchObject({
      name: "MigrationError",
      details: {
        code: "MIGRATION_META_INIT_FAILED",
        reason: "meta init failed",
      },
    });
  });

  it("returns structured MigrationError when rollback fails after migration error", async () => {
    const failingMigration: DbMigration = {
      version: 99_998,
      name: "test-rollback-failing-migration",
      up: async () => {
        throw new Error("forced migration failure");
      },
    };

    const rollbackFailingExecutor: SQLiteExecutor = {
      async execAsync(source: string) {
        if (source.includes("ROLLBACK")) {
          throw new Error("forced rollback failure");
        }
      },
      async getFirstAsync<T>() {
        return { version: 0 } as T;
      },
      async getAllAsync<T>() {
        return [] as T[];
      },
      async runAsync(_source: string, _params: SQLiteBindParams) {
        return {};
      },
    };

    DB_MIGRATIONS.push(failingMigration);
    try {
      await expect(runMigrations(rollbackFailingExecutor)).rejects.toMatchObject({
        name: "MigrationError",
        migrationVersion: failingMigration.version,
        details: {
          code: "MIGRATION_ROLLBACK_FAILED",
          migrationVersion: failingMigration.version,
          migrationName: failingMigration.name,
          reason: "forced migration failure",
          rollbackReason: "forced rollback failure",
        },
      });
    } finally {
      const index = DB_MIGRATIONS.findIndex((migration) => migration.version === failingMigration.version);
      if (index >= 0) {
        DB_MIGRATIONS.splice(index, 1);
      }
    }
  });
});
