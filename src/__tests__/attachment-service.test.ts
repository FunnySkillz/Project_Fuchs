const mockGetAttachmentRepository = jest.fn();
const mockDeleteLocalAttachmentFile = jest.fn();

jest.mock("@/repositories/create-core-repositories", () => ({
  getAttachmentRepository: () => mockGetAttachmentRepository(),
}));

jest.mock("@/services/attachment-storage", () => ({
  deleteLocalAttachmentFile: (filePath: string) => mockDeleteLocalAttachmentFile(filePath),
}));

import { deleteAttachment } from "@/services/attachment-service";

describe("attachment-service", () => {
  beforeEach(() => {
    mockGetAttachmentRepository.mockReset();
    mockDeleteLocalAttachmentFile.mockReset();
  });

  it("deletes local file before soft-deleting the DB row", async () => {
    const callOrder: string[] = [];
    const repository = {
      getById: jest.fn(async () => ({
        id: "att-1",
        filePath: "file:///tmp/receipt.pdf",
      })),
      softDelete: jest.fn(async () => {
        callOrder.push("softDelete");
      }),
    };
    mockGetAttachmentRepository.mockResolvedValue(repository);
    mockDeleteLocalAttachmentFile.mockImplementation(async () => {
      callOrder.push("deleteFile");
    });

    await deleteAttachment("att-1");

    expect(repository.getById).toHaveBeenCalledWith("att-1");
    expect(mockDeleteLocalAttachmentFile).toHaveBeenCalledWith("file:///tmp/receipt.pdf");
    expect(repository.softDelete).toHaveBeenCalledWith("att-1");
    expect(callOrder).toEqual(["deleteFile", "softDelete"]);
  });

  it("does not soft-delete the DB row when file deletion fails", async () => {
    const repository = {
      getById: jest.fn(async () => ({
        id: "att-1",
        filePath: "file:///tmp/receipt.pdf",
      })),
      softDelete: jest.fn(),
    };
    mockGetAttachmentRepository.mockResolvedValue(repository);
    mockDeleteLocalAttachmentFile.mockRejectedValue(new Error("disk busy"));

    await expect(deleteAttachment("att-1")).rejects.toThrow("disk busy");
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it("returns early when the attachment does not exist", async () => {
    const repository = {
      getById: jest.fn(async () => null),
      softDelete: jest.fn(),
    };
    mockGetAttachmentRepository.mockResolvedValue(repository);

    await deleteAttachment("missing");

    expect(repository.getById).toHaveBeenCalledWith("missing");
    expect(mockDeleteLocalAttachmentFile).not.toHaveBeenCalled();
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
});
