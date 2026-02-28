import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { MigrationError, runMigrations } from "@/db/migrate";
import { DB_MIGRATIONS } from "@/db/migrations";
import type { DbMigration } from "@/db/migrations/types";
import type { SQLiteBindParams, SQLiteExecutor } from "@/db/profile-settings-db";

interface SqliteMasterRow {
  type: "table" | "index" | "trigger";
  name: string;
}

class BetterSqliteExecutor implements SQLiteExecutor {
  constructor(private readonly db: Database.Database) {}

  private normalizeParams(params: SQLiteBindParams): SQLiteBindParams {
    if (Array.isArray(params)) {
      return params;
    }

    const normalized: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(params)) {
      const normalizedKey = key.replace(/^[$:@]/, "");
      normalized[normalizedKey] = value;
    }
    return normalized;
  }

  async execAsync(source: string): Promise<void> {
    try {
      this.db.exec(source);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
      throw new Error(message);
    }
  }

  async getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null> {
    const statement = this.db.prepare(source);
    const preparedParams = this.normalizeParams(params);
    const row = Array.isArray(preparedParams)
      ? statement.get(...preparedParams)
      : statement.get(preparedParams);
    return (row as T | undefined) ?? null;
  }

  async getAllAsync<T>(source: string, params: SQLiteBindParams): Promise<T[]> {
    const statement = this.db.prepare(source);
    const preparedParams = this.normalizeParams(params);
    const rows = Array.isArray(preparedParams)
      ? statement.all(...preparedParams)
      : statement.all(preparedParams);
    return rows as T[];
  }

  async runAsync(source: string, params: SQLiteBindParams): Promise<unknown> {
    const statement = this.db.prepare(source);
    const preparedParams = this.normalizeParams(params);
    return Array.isArray(preparedParams)
      ? statement.run(...preparedParams)
      : statement.run(preparedParams);
  }
}

async function withTempDatabase(testFn: (db: SQLiteExecutor) => Promise<void>) {
  const tempFile = path.join(
    os.tmpdir(),
    `steuerfuchs-migrations-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
  const sqlite = new Database(tempFile);
  const executor = new BetterSqliteExecutor(sqlite);

  try {
    await testFn(executor);
  } finally {
    sqlite.close();
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

describe("runMigrations integration", () => {
  it("creates schema tables, indexes, triggers, and enables foreign keys on fresh DB", async () => {
    await withTempDatabase(async (db) => {
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
      await withTempDatabase(async (db) => {
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
