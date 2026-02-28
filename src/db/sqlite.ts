import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { runMigrations } from "@/db/migrate";

const DATABASE_NAME = "steuerfuchs.db";

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await runMigrations(db);
      return db;
    });
  }

  return databasePromise;
}
