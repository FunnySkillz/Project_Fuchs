const mockGetAttachmentRepository = jest.fn();
const mockDeleteLocalAttachmentFile = jest.fn();
let mockUuidCounter = 0;

jest.mock("expo-crypto", () => ({
  randomUUID: () => `attachment-test-uuid-${mockUuidCounter++}`,
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getAttachmentRepository: () => mockGetAttachmentRepository(),
}));

jest.mock("@/services/attachment-storage", () => ({
  deleteLocalAttachmentFile: (filePath: string) => mockDeleteLocalAttachmentFile(filePath),
}));

import { withTempSqliteExecutor } from "@/__tests__/helpers/sqlite-test-utils";
import { runMigrations } from "@/db/migrate";
import { SQLiteAttachmentRepository } from "@/repositories/attachment-repository";
import { SQLiteItemRepository } from "@/repositories/item-repository";
import { deleteAttachment } from "@/services/attachment-service";

async function createItem(itemRepository: SQLiteItemRepository) {
  return itemRepository.create({
    title: "Work Laptop",
    purchaseDate: "2026-02-10",
    totalCents: 199_900,
    usageType: "WORK",
    workPercent: null,
    categoryId: null,
    vendor: "Store",
    warrantyMonths: 24,
    notes: "Invoice kept",
    usefulLifeMonthsOverride: null,
  });
}

describe("Attachment consistency", () => {
  beforeEach(() => {
    mockGetAttachmentRepository.mockReset();
    mockDeleteLocalAttachmentFile.mockReset();
    mockDeleteLocalAttachmentFile.mockResolvedValue(undefined);
    mockUuidCounter = 0;
  });

  it("creates attachment rows and soft-deletes rows while cleaning local files", async () => {
    await withTempSqliteExecutor(async (db) => {
      await runMigrations(db);
      const itemRepository = new SQLiteItemRepository(db);
      const attachmentRepository = new SQLiteAttachmentRepository(db);
      mockGetAttachmentRepository.mockResolvedValue(attachmentRepository);

      const item = await createItem(itemRepository);
      const filePath = "file:///tmp/steuerfuchs-tests/attachments/receipt-a.pdf";
      const created = await attachmentRepository.add({
        itemId: item.id,
        type: "RECEIPT",
        mimeType: "application/pdf",
        filePath,
        originalFileName: "receipt-a.pdf",
        fileSizeBytes: 12_000,
      });

      const listed = await attachmentRepository.listByItem(item.id);
      expect(listed).toHaveLength(1);
      expect(listed[0].id).toBe(created.id);

      await deleteAttachment(created.id);

      const visibleAfterDelete = await attachmentRepository.listByItem(item.id);
      const allAfterDelete = await attachmentRepository.listByItem(item.id, {
        includeDeleted: true,
      });
      expect(visibleAfterDelete).toHaveLength(0);
      expect(allAfterDelete).toHaveLength(1);
      expect(allAfterDelete[0].deletedAt).not.toBeNull();
      expect(mockDeleteLocalAttachmentFile).toHaveBeenCalledWith(filePath);
    });
  });

  it("cascades attachment soft-delete when deleting an item", async () => {
    await withTempSqliteExecutor(async (db) => {
      await runMigrations(db);
      const itemRepository = new SQLiteItemRepository(db);
      const attachmentRepository = new SQLiteAttachmentRepository(db);
      const item = await createItem(itemRepository);

      await attachmentRepository.add({
        itemId: item.id,
        type: "RECEIPT",
        mimeType: "application/pdf",
        filePath: "file:///tmp/steuerfuchs-tests/attachments/receipt-main.pdf",
        originalFileName: "receipt-main.pdf",
        fileSizeBytes: 8_000,
      });
      await attachmentRepository.add({
        itemId: item.id,
        type: "PHOTO",
        mimeType: "image/jpeg",
        filePath: "file:///tmp/steuerfuchs-tests/attachments/photo-1.jpg",
        originalFileName: "photo-1.jpg",
        fileSizeBytes: 14_000,
      });

      await itemRepository.softDelete(item.id);

      const activeAttachments = await attachmentRepository.listByItem(item.id);
      const allAttachments = await attachmentRepository.listByItem(item.id, {
        includeDeleted: true,
      });

      expect(activeAttachments).toHaveLength(0);
      expect(allAttachments).toHaveLength(2);
      for (const attachment of allAttachments) {
        expect(attachment.deletedAt).not.toBeNull();
      }
    });
  });

  it("does not crash when reading attachment rows that point to missing files", async () => {
    await withTempSqliteExecutor(async (db) => {
      await runMigrations(db);
      const itemRepository = new SQLiteItemRepository(db);
      const attachmentRepository = new SQLiteAttachmentRepository(db);
      const item = await createItem(itemRepository);

      await attachmentRepository.add({
        itemId: item.id,
        type: "RECEIPT",
        mimeType: "image/jpeg",
        filePath: "file:///tmp/steuerfuchs-tests/attachments/missing-file.jpg",
        originalFileName: "missing-file.jpg",
        fileSizeBytes: null,
      });

      await expect(attachmentRepository.listByItem(item.id)).resolves.toHaveLength(1);
    });
  });
});
