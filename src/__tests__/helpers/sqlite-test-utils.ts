import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SQLiteBindParams, SQLiteExecutor } from "@/db/profile-settings-db";

export class BetterSqliteExecutor implements SQLiteExecutor {
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
    this.db.exec(source);
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

export async function withTempSqliteExecutor(testFn: (db: SQLiteExecutor) => Promise<void>) {
  const tempFile = path.join(
    os.tmpdir(),
    `steuerfuchs-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
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
