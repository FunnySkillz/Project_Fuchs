import type { SQLiteExecutor } from "@/db/profile-settings-db";

interface TableColumnInfo {
  name: string;
}

export async function applyMigration0006TaxProfileFields(
  db: SQLiteExecutor
): Promise<void> {
  const columns = await db.getAllAsync<TableColumnInfo>(
    "PRAGMA table_info('ProfileSettings');",
    []
  );
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("MonthlyGrossIncomeCents")) {
    await db.execAsync(
      "ALTER TABLE ProfileSettings ADD COLUMN MonthlyGrossIncomeCents INTEGER NOT NULL DEFAULT 0;"
    );
  }
  if (!columnNames.has("SalaryPaymentsPerYear")) {
    await db.execAsync(
      "ALTER TABLE ProfileSettings ADD COLUMN SalaryPaymentsPerYear INTEGER NOT NULL DEFAULT 14;"
    );
  }
  if (!columnNames.has("UseManualMarginalTaxRate")) {
    await db.execAsync(
      "ALTER TABLE ProfileSettings ADD COLUMN UseManualMarginalTaxRate INTEGER NOT NULL DEFAULT 0;"
    );
  }
  if (!columnNames.has("ManualMarginalRateBps")) {
    await db.execAsync(
      "ALTER TABLE ProfileSettings ADD COLUMN ManualMarginalRateBps INTEGER NOT NULL DEFAULT 4000;"
    );
  }
  if (!columnNames.has("WerbungskostenPauschaleEnabled")) {
    await db.execAsync(
      "ALTER TABLE ProfileSettings ADD COLUMN WerbungskostenPauschaleEnabled INTEGER NOT NULL DEFAULT 1;"
    );
  }
  if (!columnNames.has("WerbungskostenPauschaleAmountCents")) {
    await db.execAsync(
      "ALTER TABLE ProfileSettings ADD COLUMN WerbungskostenPauschaleAmountCents INTEGER NOT NULL DEFAULT 13200;"
    );
  }

  await db.runAsync(
    `UPDATE ProfileSettings
     SET MonthlyGrossIncomeCents = 0
     WHERE MonthlyGrossIncomeCents IS NULL OR MonthlyGrossIncomeCents < 0;`,
    []
  );
  await db.runAsync(
    `UPDATE ProfileSettings
     SET SalaryPaymentsPerYear = 14
     WHERE SalaryPaymentsPerYear IS NULL OR SalaryPaymentsPerYear NOT IN (12, 14);`,
    []
  );
  await db.runAsync(
    `UPDATE ProfileSettings
     SET UseManualMarginalTaxRate = 0
     WHERE UseManualMarginalTaxRate IS NULL OR UseManualMarginalTaxRate NOT IN (0, 1);`,
    []
  );
  await db.runAsync(
    `UPDATE ProfileSettings
     SET ManualMarginalRateBps = 4000
     WHERE ManualMarginalRateBps IS NULL OR ManualMarginalRateBps < 0 OR ManualMarginalRateBps > 10000;`,
    []
  );
  await db.runAsync(
    `UPDATE ProfileSettings
     SET WerbungskostenPauschaleEnabled = 1
     WHERE WerbungskostenPauschaleEnabled IS NULL OR WerbungskostenPauschaleEnabled NOT IN (0, 1);`,
    []
  );
  await db.runAsync(
    `UPDATE ProfileSettings
     SET WerbungskostenPauschaleAmountCents = 13200
     WHERE WerbungskostenPauschaleAmountCents IS NULL OR WerbungskostenPauschaleAmountCents < 0;`,
    []
  );
}
