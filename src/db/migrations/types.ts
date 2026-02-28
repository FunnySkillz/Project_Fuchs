import type { SQLiteExecutor } from "@/db/profile-settings-db";

export interface DbMigration {
  version: number;
  name: string;
  up: (db: SQLiteExecutor) => Promise<void>;
}
