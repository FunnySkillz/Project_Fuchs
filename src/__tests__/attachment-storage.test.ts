const mockGetDocumentAsync = jest.fn();

const mockDirs = new Set<string>();
const mockFiles = new Map<string, number>();

const mockGetInfoAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock("expo-file-system/legacy", () => {
  const moduleMock = {
    documentDirectory: "file:///tmp/steuerfuchs-tests/",
    getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
    makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
    copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
    deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  };

  return {
    __esModule: true,
    ...moduleMock,
    default: moduleMock,
  };
});

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: "jpeg",
  },
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

import { attachmentFileExists, saveFromPicker } from "@/services/attachment-storage";

describe("attachment storage", () => {
  beforeEach(() => {
    mockGetDocumentAsync.mockReset();
    mockGetInfoAsync.mockReset();
    mockMakeDirectoryAsync.mockReset();
    mockCopyAsync.mockReset();
    mockDeleteAsync.mockReset();
    mockDirs.clear();
    mockFiles.clear();

    mockGetInfoAsync.mockImplementation(async (path: string) => {
      if (mockDirs.has(path)) {
        return { exists: true, isDirectory: true, size: null };
      }

      if (mockFiles.has(path)) {
        return { exists: true, isDirectory: false, size: mockFiles.get(path) ?? null };
      }

      return { exists: false, isDirectory: false, size: null };
    });

    mockMakeDirectoryAsync.mockImplementation(async (path: string) => {
      mockDirs.add(path);
    });

    mockCopyAsync.mockImplementation(async ({ to }: { from: string; to: string }) => {
      mockFiles.set(to, 3_456);
    });

    mockDeleteAsync.mockImplementation(async (path: string) => {
      mockFiles.delete(path);
      mockDirs.delete(path);
    });
  });

  it("saves picked files into the attachment temp sandbox and reports file existence", async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///tmp/source/receipt.pdf",
          mimeType: "application/pdf",
          name: "receipt.pdf",
          size: 3_456,
        },
      ],
    });

    const saved = await saveFromPicker();
    expect(saved).not.toBeNull();
    expect(saved?.filePath.includes("attachments/")).toBe(true);
    expect(saved?.filePath.includes("/Users/")).toBe(false);
    expect(saved?.filePath.includes("\\Users\\")).toBe(false);
    expect(saved?.mimeType).toBe("application/pdf");

    const exists = await attachmentFileExists(saved!.filePath);
    expect(exists).toBe(true);
    expect(mockCopyAsync).toHaveBeenCalledTimes(1);
    expect(saved?.filePath).toBe(mockCopyAsync.mock.calls[0][0].to);
    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(
      "file:///tmp/steuerfuchs-tests/attachments",
      { intermediates: true }
    );
  });
});
