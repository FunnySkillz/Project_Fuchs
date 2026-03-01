const mockDeleteLocalAttachmentFile = jest.fn();

jest.mock("@/services/attachment-storage", () => ({
  deleteLocalAttachmentFile: (filePath: string) => mockDeleteLocalAttachmentFile(filePath),
}));

import {
  addAttachmentToDraft,
  clearItemDraft,
  createItemDraft,
  getItemDraftAttachments,
  removeAttachmentFromDraft,
} from "@/services/item-draft-store";

describe("item-draft-store", () => {
  beforeEach(() => {
    mockDeleteLocalAttachmentFile.mockReset();
    mockDeleteLocalAttachmentFile.mockResolvedValue(undefined);
  });

  it("keeps draft attachment reference when local file deletion fails", async () => {
    const draftId = createItemDraft();
    addAttachmentToDraft(draftId, {
      filePath: "file:///tmp/receipt-a.jpg",
      mimeType: "image/jpeg",
      originalFileName: "receipt-a.jpg",
      fileSizeBytes: 123,
      type: "RECEIPT",
    });

    mockDeleteLocalAttachmentFile.mockRejectedValueOnce(new Error("cannot delete file"));

    await expect(removeAttachmentFromDraft(draftId, "file:///tmp/receipt-a.jpg")).rejects.toThrow(
      "cannot delete file"
    );
    expect(getItemDraftAttachments(draftId)).toHaveLength(1);

    await clearItemDraft(draftId);
  });

  it("removes draft attachment only after file cleanup succeeds", async () => {
    const draftId = createItemDraft();
    addAttachmentToDraft(draftId, {
      filePath: "file:///tmp/photo-1.jpg",
      mimeType: "image/jpeg",
      originalFileName: "photo-1.jpg",
      fileSizeBytes: 321,
      type: "PHOTO",
    });

    await removeAttachmentFromDraft(draftId, "file:///tmp/photo-1.jpg");

    expect(mockDeleteLocalAttachmentFile).toHaveBeenCalledWith("file:///tmp/photo-1.jpg");
    expect(getItemDraftAttachments(draftId)).toHaveLength(0);

    await clearItemDraft(draftId);
  });
});
