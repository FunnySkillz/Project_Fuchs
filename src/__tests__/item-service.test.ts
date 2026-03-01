const mockGetItemRepository = jest.fn();
const mockGetAttachmentRepository = jest.fn();
const mockDeleteAttachment = jest.fn();

jest.mock("@/repositories/create-core-repositories", () => ({
  getItemRepository: () => mockGetItemRepository(),
  getAttachmentRepository: () => mockGetAttachmentRepository(),
}));

jest.mock("@/services/attachment-service", () => ({
  deleteAttachment: (attachmentId: string) => mockDeleteAttachment(attachmentId),
}));

import { deleteItemWithAttachments } from "@/services/item-service";

describe("item-service", () => {
  beforeEach(() => {
    mockGetItemRepository.mockReset();
    mockGetAttachmentRepository.mockReset();
    mockDeleteAttachment.mockReset();
  });

  it("deletes linked attachment binaries before soft deleting item", async () => {
    const callOrder: string[] = [];
    mockGetAttachmentRepository.mockResolvedValue({
      listByItem: jest.fn(async () => [
        { id: "att-1" },
        { id: "att-2" },
      ]),
    });
    mockGetItemRepository.mockResolvedValue({
      softDelete: jest.fn(async () => {
        callOrder.push("softDeleteItem");
      }),
    });
    mockDeleteAttachment.mockImplementation(async (attachmentId: string) => {
      callOrder.push(`deleteAttachment:${attachmentId}`);
    });

    await deleteItemWithAttachments("item-1");

    expect(mockDeleteAttachment).toHaveBeenNthCalledWith(1, "att-1");
    expect(mockDeleteAttachment).toHaveBeenNthCalledWith(2, "att-2");
    expect(callOrder).toEqual([
      "deleteAttachment:att-1",
      "deleteAttachment:att-2",
      "softDeleteItem",
    ]);
  });
});
