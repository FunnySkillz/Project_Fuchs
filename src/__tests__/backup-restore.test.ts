import JSZip from "jszip";

const mockDocumentDirectory = "file:///tmp/steuerfuchs-tests/";
const mockSqliteDir = `${mockDocumentDirectory}SQLite`;
const mockAttachmentRootDir = `${mockDocumentDirectory}attachments`;

const mockGetDatabase = jest.fn();
const mockCloseDatabase = jest.fn();
const mockResetDatabase = jest.fn();
const mockDeleteAllLocalAttachmentFiles = jest.fn();

const mockInMemoryDirs = new Set<string>();
const mockInMemoryFiles = new Map<string, string>();

function mockNormalizePath(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function mockParentDir(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return null;
  }
  return normalized.slice(0, lastSlash);
}

jest.mock("expo-file-system/legacy", () => {
  const mockFsDocumentDirectory = "file:///tmp/steuerfuchs-tests/";

  const getInfoAsync = async (path: string) => {
    const normalized = mockNormalizePath(path);
    if (mockInMemoryDirs.has(normalized)) {
      return { exists: true, isDirectory: true, size: null };
    }

    if (mockInMemoryFiles.has(path)) {
      return {
        exists: true,
        isDirectory: false,
        size: mockInMemoryFiles.get(path)?.length ?? null,
      };
    }

    return { exists: false, isDirectory: false, size: null };
  };

  const makeDirectoryAsync = async (path: string) => {
    mockInMemoryDirs.add(mockNormalizePath(path));
  };

  const readAsStringAsync = async (path: string) => {
    const value = mockInMemoryFiles.get(path);
    if (value === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return value;
  };

  const writeAsStringAsync = async (path: string, value: string) => {
    const dir = mockParentDir(path);
    if (dir) {
      mockInMemoryDirs.add(mockNormalizePath(dir));
    }
    mockInMemoryFiles.set(path, value);
  };

  const copyAsync = async ({ from, to }: { from: string; to: string }) => {
    const value = mockInMemoryFiles.get(from);
    if (value === undefined) {
      throw new Error(`File not found: ${from}`);
    }
    const dir = mockParentDir(to);
    if (dir) {
      mockInMemoryDirs.add(mockNormalizePath(dir));
    }
    mockInMemoryFiles.set(to, value);
  };

  const deleteAsync = async (path: string) => {
    mockInMemoryFiles.delete(path);
    const normalized = mockNormalizePath(path);
    mockInMemoryDirs.delete(normalized);
    for (const key of Array.from(mockInMemoryFiles.keys())) {
      if (key.startsWith(`${normalized}/`)) {
        mockInMemoryFiles.delete(key);
      }
    }
  };

  const moduleMock = {
    documentDirectory: mockFsDocumentDirectory,
    EncodingType: {
      Base64: "base64",
    },
    getInfoAsync,
    makeDirectoryAsync,
    readAsStringAsync,
    writeAsStringAsync,
    copyAsync,
    deleteAsync,
  };

  return {
    __esModule: true,
    ...moduleMock,
    default: moduleMock,
  };
});

jest.mock("@/db/sqlite", () => ({
  DATABASE_NAME: "steuerfuchs.db",
  getDatabase: () => mockGetDatabase(),
  closeDatabase: () => mockCloseDatabase(),
  resetDatabase: () => mockResetDatabase(),
}));

jest.mock("@/services/attachment-storage", () => ({
  attachmentFileExists: async (filePath: string) => mockInMemoryFiles.has(filePath),
  deleteAllLocalAttachmentFiles: () => mockDeleteAllLocalAttachmentFiles(),
  getAttachmentRootDir: () => mockAttachmentRootDir,
  buildAttachmentFilePath: (fileName: string) => `${mockAttachmentRootDir}/${fileName}`,
}));

import { createLocalBackupZip, restoreFromBackupZip } from "@/services/backup-restore";

describe("backup-restore service", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockGetDatabase.mockReset();
    mockCloseDatabase.mockReset();
    mockResetDatabase.mockReset();
    mockDeleteAllLocalAttachmentFiles.mockReset();
    mockDeleteAllLocalAttachmentFiles.mockImplementation(async () => {
      for (const key of Array.from(mockInMemoryFiles.keys())) {
        if (key.startsWith(`${mockAttachmentRootDir}/`)) {
          mockInMemoryFiles.delete(key);
        }
      }
      mockInMemoryDirs.delete(mockNormalizePath(mockAttachmentRootDir));
    });

    mockInMemoryFiles.clear();
    mockInMemoryDirs.clear();
    mockInMemoryDirs.add(mockNormalizePath(mockDocumentDirectory));
    mockInMemoryDirs.add(mockNormalizePath(mockSqliteDir));
    mockInMemoryDirs.add(mockNormalizePath(mockAttachmentRootDir));
  });

  it("creates a full backup ZIP with DB, manifest, and attachment binaries", async () => {
    const dbFileUri = `${mockSqliteDir}/steuerfuchs.db`;
    const attachmentPath = `${mockAttachmentRootDir}/att-1.jpg`;
    mockInMemoryFiles.set(dbFileUri, "ZGItYnl0ZXM=");
    mockInMemoryFiles.set(attachmentPath, "YXR0YWNobWVudC1ieXRlcw==");

    mockGetDatabase.mockResolvedValue({
      getAllAsync: jest.fn(async () => [
        {
          itemId: "item-1",
          attachmentId: "att-1",
          type: "RECEIPT",
          mimeType: "image/jpeg",
          filePath: attachmentPath,
          originalFileName: "receipt.jpg",
          fileSizeBytes: null,
        },
      ]),
    });

    const result = await createLocalBackupZip();
    const zipBase64 = mockInMemoryFiles.get(result.fileUri);
    expect(zipBase64).toBeDefined();

    const zip = await JSZip.loadAsync(zipBase64!, { base64: true });
    expect(zip.file("db/steuerfuchs.db")).toBeTruthy();
    expect(zip.file("meta.json")).toBeTruthy();
    const manifestRaw = await zip.file("manifest.json")!.async("text");
    const manifest = JSON.parse(manifestRaw);
    expect(manifest.attachmentCount).toBe(1);
    expect(manifest.attachments[0].itemId).toBe("item-1");
    expect(manifest.attachments[0].relativePath).toBe("attachments/att-1.jpg");
    expect(manifest.attachments[0].fileSizeBytes).toBeNull();
    expect(zip.file("attachments/att-1.jpg")).toBeTruthy();
  });

  it("restores DB and attachment files and rewrites attachment file paths", async () => {
    const runAsync = jest.fn(async () => undefined);
    mockGetDatabase.mockResolvedValue({
      runAsync,
      getFirstAsync: jest.fn(async () => ({ count: 3 })),
      getAllAsync: jest.fn(async () => [
        { id: "att-1", filePath: `${mockAttachmentRootDir}/att-1.jpg` },
      ]),
    });

    const manifest = {
      attachmentCount: 1,
      missingAttachmentCount: 0,
      attachments: [
        {
          itemId: "item-1",
          attachmentId: "att-1",
          type: "RECEIPT",
          mimeType: "image/jpeg",
          relativePath: "attachments/att-1.jpg",
          fileSizeBytes: 1234,
          originalFileName: "a1.jpg",
        },
      ],
    };
    const meta = {
      backupVersion: 1,
      appVersion: "1.0.0",
      schemaVersion: 1,
      databaseName: "steuerfuchs.db",
      createdAt: "2026-03-01T12:00:00.000Z",
    };

    const zip = new JSZip();
    zip.file("db/steuerfuchs.db", "cmVzdG9yZWQtZGI=", { base64: true });
    zip.file("attachments/att-1.jpg", "cmVzdG9yZWQtYXR0YWNobWVudA==", { base64: true });
    zip.file("manifest.json", JSON.stringify(manifest));
    zip.file("meta.json", JSON.stringify(meta));
    const backupUri = `${mockDocumentDirectory}import.zip`;
    mockInMemoryFiles.set(backupUri, await zip.generateAsync({ type: "base64" }));

    const summary = await restoreFromBackupZip(backupUri);

    expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
    expect(mockResetDatabase).toHaveBeenCalledTimes(1);
    expect(mockDeleteAllLocalAttachmentFiles).toHaveBeenCalledTimes(1);
    expect(mockInMemoryFiles.has(`${mockSqliteDir}/steuerfuchs.db`)).toBe(true);
    expect(mockInMemoryFiles.has(`${mockAttachmentRootDir}/att-1.jpg`)).toBe(true);
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE Attachment"),
      {
        $attachmentId: "att-1",
        $filePath: `${mockAttachmentRootDir}/att-1.jpg`,
      }
    );
    expect(summary).toEqual({
      itemCountRestored: 3,
      attachmentCountRestored: 1,
      missingFilesCount: 0,
    });
  });

  it("rejects invalid backup ZIP before overwrite when attachment payload is missing", async () => {
    mockGetDatabase.mockResolvedValue({
      runAsync: jest.fn(async () => undefined),
    });

    const invalidManifest = {
      attachmentCount: 1,
      missingAttachmentCount: 0,
      attachments: [
        {
          itemId: "item-1",
          attachmentId: "att-1",
          type: "PHOTO",
          mimeType: "image/jpeg",
          relativePath: "attachments/att-1.jpg",
          fileSizeBytes: 123,
          originalFileName: "photo.jpg",
        },
      ],
    };
    const meta = {
      backupVersion: 1,
      appVersion: "1.0.0",
      schemaVersion: 1,
      databaseName: "steuerfuchs.db",
      createdAt: "2026-03-01T12:00:00.000Z",
    };

    const zip = new JSZip();
    zip.file("db/steuerfuchs.db", "c29tZS1kYg==", { base64: true });
    zip.file("manifest.json", JSON.stringify(invalidManifest));
    zip.file("meta.json", JSON.stringify(meta));
    const backupUri = `${mockDocumentDirectory}invalid.zip`;
    mockInMemoryFiles.set(backupUri, await zip.generateAsync({ type: "base64" }));

    await expect(restoreFromBackupZip(backupUri)).rejects.toThrow("missing attachment payload");
    expect(mockResetDatabase).not.toHaveBeenCalled();
  });
});
