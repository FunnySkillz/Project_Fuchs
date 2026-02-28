import { withTempSqliteExecutor } from "@/__tests__/helpers/sqlite-test-utils";
import { MIGRATION_0001_INITIAL_SCHEMA } from "@/db/migrations/0001-initial-schema";
import { MIGRATION_0002_APP_LOCK_COLUMN } from "@/db/migrations/0002-app-lock";
import { MIGRATION_0003_UPLOAD_TOGGLE_COLUMN } from "@/db/migrations/0003-upload-toggle";
import { PROFILE_SETTINGS_SINGLETON_ID } from "@/db/profile-settings-db";
import { runSeedData } from "@/db/seed";

interface CategoryPresetRow {
  id: string;
  isPreset: number;
  sortOrder: number;
}

describe("runSeedData integration", () => {
  it("is idempotent and preserves preset metadata", async () => {
    await withTempSqliteExecutor(async (db) => {
      await db.execAsync(MIGRATION_0001_INITIAL_SCHEMA);
      await db.execAsync(MIGRATION_0002_APP_LOCK_COLUMN);
      await db.execAsync(MIGRATION_0003_UPLOAD_TOGGLE_COLUMN);

      await runSeedData(db, new Date("2026-01-15T12:00:00.000Z"));

      const firstProfileCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM ProfileSettings WHERE Id = $id;",
        { $id: PROFILE_SETTINGS_SINGLETON_ID }
      );
      const firstCategoryCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM Category;",
        []
      );
      const firstPresets = await db.getAllAsync<CategoryPresetRow>(
        "SELECT Id AS id, IsPreset AS isPreset, SortOrder AS sortOrder FROM Category ORDER BY SortOrder ASC;",
        []
      );

      await runSeedData(db, new Date("2030-05-01T00:00:00.000Z"));

      const secondProfileCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM ProfileSettings WHERE Id = $id;",
        { $id: PROFILE_SETTINGS_SINGLETON_ID }
      );
      const secondCategoryCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM Category;",
        []
      );
      const secondPresets = await db.getAllAsync<CategoryPresetRow>(
        "SELECT Id AS id, IsPreset AS isPreset, SortOrder AS sortOrder FROM Category ORDER BY SortOrder ASC;",
        []
      );

      expect(firstProfileCount?.count).toBe(1);
      expect(firstCategoryCount?.count).toBe(6);

      expect(secondProfileCount?.count).toBe(firstProfileCount?.count);
      expect(secondCategoryCount?.count).toBe(firstCategoryCount?.count);

      expect(firstPresets.length).toBe(6);
      expect(secondPresets).toEqual(firstPresets);
      expect(secondPresets.every((row) => row.isPreset === 1)).toBe(true);
    });
  });
});
