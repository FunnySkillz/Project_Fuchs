import { withTempSqliteExecutor } from "@/__tests__/helpers/sqlite-test-utils";
import { runMigrations } from "@/db/migrate";
import { DB_MIGRATIONS } from "@/db/migrations";
import { PROFILE_SETTINGS_SINGLETON_ID } from "@/db/profile-settings-db";
import { runSeedData } from "@/db/seed";
import { SQLiteAttachmentRepository } from "@/repositories/attachment-repository";
import { SQLiteItemRepository } from "@/repositories/item-repository";

let mockUuidCounter = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: () => `db-integrity-uuid-${mockUuidCounter++}`,
}));

interface SqliteMasterRow {
  type: "table" | "index" | "trigger";
  name: string;
}

describe("database integrity integration", () => {
  beforeEach(() => {
    mockUuidCounter = 0;
  });

  it("runs migrations, creates schema artifacts, and keeps seed data idempotent", async () => {
    await withTempSqliteExecutor(async (db) => {
      await runMigrations(db);
      await runSeedData(db, new Date("2026-01-15T12:00:00.000Z"));
      await runSeedData(db, new Date("2032-03-20T09:00:00.000Z"));

      const objects = await db.getAllAsync<SqliteMasterRow>(
        `SELECT type, name
         FROM sqlite_master
         WHERE type IN ('table', 'index', 'trigger')`,
        []
      );
      const names = new Set(objects.map((row) => row.name));
      const currentSchemaVersion = await db.getFirstAsync<{ version: number }>(
        "SELECT version FROM schema_migrations WHERE id = 1 LIMIT 1;",
        []
      );
      const profileSettingsCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM ProfileSettings WHERE Id = $id;",
        { $id: PROFILE_SETTINGS_SINGLETON_ID }
      );
      const presetCategoryCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM Category WHERE IsPreset = 1;",
        []
      );

      expect(currentSchemaVersion?.version).toBe(DB_MIGRATIONS[DB_MIGRATIONS.length - 1].version);
      expect(profileSettingsCount?.count).toBe(1);
      expect(presetCategoryCount?.count).toBe(6);
      expect(Array.from(names)).toEqual(
        expect.arrayContaining([
          "schema_migrations",
          "ProfileSettings",
          "Category",
          "Item",
          "Attachment",
          "ExportRun",
          "TR_ProfileSettings_UpdatedAt",
          "TR_Category_UpdatedAt",
          "TR_Item_UpdatedAt",
          "TR_Attachment_UpdatedAt",
          "TR_ExportRun_UpdatedAt",
          "IX_Item_NotDeleted",
          "IX_Attachment_NotDeleted",
          "IX_ExportRun_TaxYear",
        ])
      );
    });
  });

  it("updates UpdatedAt via trigger on direct row update", async () => {
    await withTempSqliteExecutor(async (db) => {
      await runMigrations(db);

      const itemId = "trigger-item-1";
      await db.runAsync(
        `INSERT INTO Item (
          Id,
          Title,
          PurchaseDate,
          TotalCents,
          Currency,
          UsageType,
          WorkPercent,
          CategoryId,
          Vendor,
          WarrantyMonths,
          Notes,
          UsefulLifeMonthsOverride
        ) VALUES (
          $id,
          'Trigger test',
          '2026-02-10',
          120000,
          'EUR',
          'WORK',
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        );`,
        { $id: itemId }
      );

      const legacyTimestamp = "2000-01-01T00:00:00.000Z";
      await db.runAsync(
        `UPDATE Item SET UpdatedAt = $updatedAt WHERE Id = $id;`,
        { $updatedAt: legacyTimestamp, $id: itemId }
      );
      await db.runAsync(
        `UPDATE Item SET Notes = 'updated by trigger test' WHERE Id = $id;`,
        { $id: itemId }
      );

      const row = await db.getFirstAsync<{ updatedAt: string; notes: string | null }>(
        `SELECT UpdatedAt AS updatedAt, Notes AS notes
         FROM Item
         WHERE Id = $id
         LIMIT 1;`,
        { $id: itemId }
      );

      expect(row?.notes).toBe("updated by trigger test");
      expect(row?.updatedAt).not.toBe(legacyTimestamp);
    });
  });

  it("soft-deletes and restores item + attachment records through repositories", async () => {
    await withTempSqliteExecutor(async (db) => {
      await runMigrations(db);

      const itemRepository = new SQLiteItemRepository(db);
      const attachmentRepository = new SQLiteAttachmentRepository(db);

      const createdItem = await itemRepository.create({
        title: "Soft delete flow",
        purchaseDate: "2026-04-01",
        totalCents: 299_900,
        usageType: "WORK",
        workPercent: null,
        categoryId: null,
        vendor: "Test Store",
        warrantyMonths: 24,
        notes: "integration test",
      });
      const createdAttachment = await attachmentRepository.add({
        itemId: createdItem.id,
        type: "RECEIPT",
        mimeType: "application/pdf",
        filePath: "/tmp/soft-delete-receipt.pdf",
        originalFileName: "soft-delete-receipt.pdf",
        fileSizeBytes: 1024,
      });

      await itemRepository.softDelete(createdItem.id);

      const hiddenItem = await itemRepository.getById(createdItem.id);
      const deletedItem = await itemRepository.getById(createdItem.id, { includeDeleted: true });
      const hiddenAttachments = await attachmentRepository.listByItem(createdItem.id);
      const deletedAttachments = await attachmentRepository.listByItem(createdItem.id, {
        includeDeleted: true,
      });

      expect(hiddenItem).toBeNull();
      expect(deletedItem?.deletedAt).not.toBeNull();
      expect(hiddenAttachments).toHaveLength(0);
      expect(deletedAttachments).toHaveLength(1);
      expect(deletedAttachments[0].id).toBe(createdAttachment.id);
      expect(deletedAttachments[0].deletedAt).not.toBeNull();

      await itemRepository.restore(createdItem.id);

      const restoredItem = await itemRepository.getById(createdItem.id);
      const restoredAttachment = await attachmentRepository.getById(createdAttachment.id);

      expect(restoredItem?.deletedAt).toBeNull();
      expect(restoredAttachment?.deletedAt).toBeNull();
    });
  });
});
