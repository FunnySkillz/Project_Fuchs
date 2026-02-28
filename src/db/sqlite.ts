import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { runMigrations } from "@/db/migrate";
import { runSeedData } from "@/db/seed";

export const DATABASE_NAME = "steuerfuchs.db";

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME)
      .then(async (db) => {
        await db.execAsync("PRAGMA foreign_keys = ON;");
        await runMigrations(db);
        await runSeedData(db);
        return db;
      })
      .catch((error) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  if (!databasePromise) {
    return;
  }

  const db = await databasePromise;
  await db.closeAsync();
  databasePromise = null;
}

export async function resetDatabase(): Promise<void> {
  await closeDatabase();
  await deleteDatabaseAsync(DATABASE_NAME);
}
