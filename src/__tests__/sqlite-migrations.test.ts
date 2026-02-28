import { MigrationError, runMigrations } from "@/db/migrate";
import { DB_MIGRATIONS } from "@/db/migrations";
import type { DbMigration } from "@/db/migrations/types";
import { withTempSqliteExecutor } from "@/__tests__/helpers/sqlite-test-utils";

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
        });
      });
    } finally {
      const index = DB_MIGRATIONS.findIndex((migration) => migration.version === failingMigration.version);
      if (index >= 0) {
        DB_MIGRATIONS.splice(index, 1);
      }
    }
  });
});
