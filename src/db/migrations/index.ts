import { MIGRATION_0001_INITIAL_SCHEMA } from "@/db/migrations/0001-initial-schema";
import { MIGRATION_0002_APP_LOCK_COLUMN } from "@/db/migrations/0002-app-lock";
import { MIGRATION_0003_UPLOAD_TOGGLE_COLUMN } from "@/db/migrations/0003-upload-toggle";
import { MIGRATION_0004_CATEGORY_PRESETS } from "@/db/migrations/0004-category-presets";
import { applyMigration0005ThemeModePreference } from "@/db/migrations/0005-theme-mode-preference";
import type { DbMigration } from "@/db/migrations/types";

export const DB_MIGRATIONS: DbMigration[] = [
  {
    version: 1,
    name: "initial-schema",
    up: async (db) => {
      await db.execAsync(MIGRATION_0001_INITIAL_SCHEMA);
    },
  },
  {
    version: 2,
    name: "profile-settings-app-lock",
    up: async (db) => {
      await db.execAsync(MIGRATION_0002_APP_LOCK_COLUMN);
    },
  },
  {
    version: 3,
    name: "profile-settings-upload-toggle",
    up: async (db) => {
      await db.execAsync(MIGRATION_0003_UPLOAD_TOGGLE_COLUMN);
    },
  },
  {
    version: 4,
    name: "category-presets",
    up: async (db) => {
      await db.execAsync(MIGRATION_0004_CATEGORY_PRESETS);
    },
  },
  {
    version: 5,
    name: "profile-settings-theme-mode-preference",
    up: async (db) => {
      await applyMigration0005ThemeModePreference(db);
    },
  },
];
