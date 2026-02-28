import { withTempSqliteExecutor } from "@/__tests__/helpers/sqlite-test-utils";
import { runMigrations } from "@/db/migrate";
import { SQLiteAttachmentRepository } from "@/repositories/attachment-repository";
import { SQLiteItemRepository } from "@/repositories/item-repository";

let mockUuidCounter = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: () => `test-uuid-${mockUuidCounter++}`,
}));

describe("SQLiteItemRepository integration", () => {
  async function withStepTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Step timed out: ${label}`)), 4_000);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  it(
    "create -> fetch -> update -> softDelete -> restore honors DeletedAt and attachment cascade",
    async () => {
    await withTempSqliteExecutor(async (db) => {
      await withStepTimeout("runMigrations", runMigrations(db));
      const itemRepository = new SQLiteItemRepository(db);
      const attachmentRepository = new SQLiteAttachmentRepository(db);

      const created = await withStepTimeout(
        "itemRepository.create",
        itemRepository.create({
        title: "Laptop",
        purchaseDate: "2026-03-10",
        totalCents: 199_900,
        usageType: "WORK",
        workPercent: null,
        categoryId: null,
        vendor: "Store",
        warrantyMonths: 24,
        notes: "Initial note",
      })
      );

      const fetched = await withStepTimeout("itemRepository.getById", itemRepository.getById(created.id));
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);

      const attached = await withStepTimeout(
        "attachmentRepository.add",
        attachmentRepository.add({
        itemId: created.id,
        type: "RECEIPT",
        mimeType: "application/pdf",
        filePath: "/tmp/test.pdf",
        originalFileName: "invoice.pdf",
        fileSizeBytes: 1234,
      })
      );
      expect(attached.deletedAt).toBeNull();

      await db.runAsync(
        `UPDATE Item
         SET UpdatedAt = '2000-01-01T00:00:00.000Z'
         WHERE Id = $id;`,
        { $id: created.id }
      );
      const updated = await withStepTimeout(
        "itemRepository.update",
        itemRepository.update({
        id: created.id,
        title: "Laptop Updated",
        purchaseDate: "2026-03-11",
        totalCents: 199_900,
        usageType: "WORK",
        workPercent: null,
        categoryId: null,
        vendor: "Store",
        warrantyMonths: 36,
        notes: "Changed",
      })
      );
      expect(updated.updatedAt).not.toBe(created.updatedAt);

      const beforeDeleteList = await withStepTimeout("itemRepository.list before delete", itemRepository.list());
      expect(beforeDeleteList.some((item) => item.id === created.id)).toBe(true);

      await withStepTimeout("itemRepository.softDelete", itemRepository.softDelete(created.id));

      const hiddenItem = await withStepTimeout("itemRepository.getById hidden", itemRepository.getById(created.id));
      const deletedItem = await withStepTimeout(
        "itemRepository.getById includeDeleted",
        itemRepository.getById(created.id, { includeDeleted: true })
      );
      expect(hiddenItem).toBeNull();
      expect(deletedItem?.deletedAt).not.toBeNull();

      const listAfterDelete = await withStepTimeout("itemRepository.list after delete", itemRepository.list());
      const listIncludingDeleted = await withStepTimeout(
        "itemRepository.list includeDeleted",
        itemRepository.list({ includeDeleted: true })
      );
      expect(listAfterDelete.some((item) => item.id === created.id)).toBe(false);
      expect(listIncludingDeleted.some((item) => item.id === created.id)).toBe(true);

      const activeAttachmentsAfterDelete = await withStepTimeout(
        "attachmentRepository.listByItem active",
        attachmentRepository.listByItem(created.id)
      );
      const allAttachmentsAfterDelete = await withStepTimeout(
        "attachmentRepository.listByItem includeDeleted",
        attachmentRepository.listByItem(created.id, { includeDeleted: true })
      );
      expect(activeAttachmentsAfterDelete).toHaveLength(0);
      expect(allAttachmentsAfterDelete).toHaveLength(1);
      expect(allAttachmentsAfterDelete[0].deletedAt).not.toBeNull();

      await withStepTimeout("itemRepository.restore", itemRepository.restore(created.id));

      const restored = await withStepTimeout("itemRepository.getById restored", itemRepository.getById(created.id));
      const restoredAttachment = await withStepTimeout(
        "attachmentRepository.getById restored",
        attachmentRepository.getById(attached.id)
      );
      expect(restored).not.toBeNull();
      expect(restored?.deletedAt).toBeNull();
      expect(restoredAttachment?.deletedAt).toBeNull();
    });
    },
    45_000
  );
});
