import { MIGRATION_0001_INITIAL_SCHEMA } from "@/db/migrations/0001-initial-schema";
import { MIGRATION_0002_APP_LOCK_COLUMN } from "@/db/migrations/0002-app-lock";
import { MIGRATION_0003_UPLOAD_TOGGLE_COLUMN } from "@/db/migrations/0003-upload-toggle";
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
];
