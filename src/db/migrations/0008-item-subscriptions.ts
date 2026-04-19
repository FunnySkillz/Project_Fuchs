import type { SQLiteExecutor } from "@/db/profile-settings-db";

interface TableColumnInfo {
  name: string;
}

export async function applyMigration0008ItemSubscriptions(
  db: SQLiteExecutor
): Promise<void> {
  const columns = await db.getAllAsync<TableColumnInfo>(
    "PRAGMA table_info('Item');",
    []
  );
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("PurchaseKind")) {
    await db.execAsync(
      "ALTER TABLE Item ADD COLUMN PurchaseKind TEXT NOT NULL DEFAULT 'ONE_TIME';"
    );
  }
  if (!columnNames.has("BillingCadence")) {
    await db.execAsync("ALTER TABLE Item ADD COLUMN BillingCadence TEXT NULL;");
  }
  if (!columnNames.has("SubscriptionEndDate")) {
    await db.execAsync("ALTER TABLE Item ADD COLUMN SubscriptionEndDate TEXT NULL;");
  }

  await db.runAsync(
    `UPDATE Item
     SET PurchaseKind = 'ONE_TIME'
     WHERE PurchaseKind IS NULL
       OR PurchaseKind NOT IN ('ONE_TIME', 'SUBSCRIPTION');`,
    []
  );

  await db.runAsync(
    `UPDATE Item
     SET BillingCadence = NULL,
         SubscriptionEndDate = NULL
     WHERE PurchaseKind <> 'SUBSCRIPTION';`,
    []
  );

  await db.runAsync(
    `UPDATE Item
     SET BillingCadence = 'MONTHLY'
     WHERE PurchaseKind = 'SUBSCRIPTION'
       AND (BillingCadence IS NULL OR BillingCadence NOT IN ('MONTHLY', 'YEARLY'));`,
    []
  );

  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS IX_Item_PurchaseKind
     ON Item(PurchaseKind);`
  );
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS IX_Item_SubscriptionEndDate
     ON Item(SubscriptionEndDate);`
  );
}
