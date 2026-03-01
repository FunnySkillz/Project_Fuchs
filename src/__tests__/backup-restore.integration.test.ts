import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import JSZip from "jszip";

import { BetterSqliteExecutor } from "@/__tests__/helpers/sqlite-test-utils";
import { runMigrations } from "@/db/migrate";

const mockGetDatabase = jest.fn();
const mockCloseDatabase = jest.fn();
const mockResetDatabase = jest.fn();

const mockDbState: {
  rootPath: string;
  documentDirectoryUri: string;
  dbFilePath: string;
  db: Database.Database | null;
  executor: BetterSqliteExecutor | null;
} = {
  rootPath: "",
  documentDirectoryUri: "",
  dbFilePath: "",
  db: null,
  executor: null,
};

function mockToFsPath(inputPath: string): string {
  if (inputPath.startsWith("file://")) {
    return fileURLToPath(inputPath);
  }
  return inputPath;
}

function mockToFileUri(inputPath: string): string {
  return pathToFileURL(inputPath).href;
}

async function mockOpenDatabaseWithMigrations(): Promise<BetterSqliteExecutor> {
  if (mockDbState.executor) {
    return mockDbState.executor;
  }

  fs.mkdirSync(path.dirname(mockDbState.dbFilePath), { recursive: true });
  mockDbState.db = new Database(mockDbState.dbFilePath);
  mockDbState.executor = new BetterSqliteExecutor(mockDbState.db);
  await runMigrations(mockDbState.executor);
  return mockDbState.executor;
}

async function mockInsertItem(
  db: BetterSqliteExecutor,
  id: string,
  title: string,
  purchaseDate: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO Item (
      Id, Title, PurchaseDate, TotalCents, Currency, UsageType
    ) VALUES ($id, $title, $purchaseDate, $totalCents, 'EUR', 'WORK');`,
    {
      $id: id,
      $title: title,
      $purchaseDate: purchaseDate,
      $totalCents: 100_00,
    }
  );
}

async function mockInsertAttachment(
  db: BetterSqliteExecutor,
  params: {
    id: string;
    itemId: string;
    filePath: string;
    fileSizeBytes: number;
    type?: "RECEIPT" | "PHOTO";
    mimeType?: string;
  }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO Attachment (
      Id, ItemId, Type, MimeType, FilePath, OriginalFileName, FileSizeBytes
    ) VALUES (
      $id, $itemId, $type, $mimeType, $filePath, $originalFileName, $fileSizeBytes
    );`,
    {
      $id: params.id,
      $itemId: params.itemId,
      $type: params.type ?? "RECEIPT",
      $mimeType: params.mimeType ?? "application/pdf",
      $filePath: params.filePath,
      $originalFileName: path.basename(mockToFsPath(params.filePath)),
      $fileSizeBytes: params.fileSizeBytes,
    }
  );
}

jest.mock("expo-file-system/legacy", () => {
  const fsProm = require("node:fs/promises");
  const fsNode = require("node:fs");
  const pathNode = require("node:path");
  const osNode = require("node:os");
  const { fileURLToPath, pathToFileURL } = require("node:url");
  const fixedRootPath = pathNode.join(osNode.tmpdir(), `steuerfuchs-backup-int-${process.pid}`);

  const toFsPath = (value: string) => {
    if (value.startsWith("file://")) {
      return fileURLToPath(value);
    }
    return value;
  };

  const getInfoAsync = async (value: string) => {
    const fsPath = toFsPath(value);
    try {
      const stat = await fsProm.stat(fsPath);
      return {
        exists: true,
        isDirectory: stat.isDirectory(),
        size: stat.isFile() ? stat.size : null,
      };
    } catch {
      return { exists: false, isDirectory: false, size: null };
    }
  };

  const makeDirectoryAsync = async (value: string, options?: { intermediates?: boolean }) => {
    const fsPath = toFsPath(value);
    await fsProm.mkdir(fsPath, { recursive: options?.intermediates ?? false });
  };

  const readAsStringAsync = async (
    value: string,
    options?: { encoding?: "base64" | string | null }
  ) => {
    const fsPath = toFsPath(value);
    const buffer = await fsProm.readFile(fsPath);
    if (options?.encoding === "base64") {
      return buffer.toString("base64");
    }
    return buffer.toString("utf8");
  };

  const writeAsStringAsync = async (
    value: string,
    data: string,
    options?: { encoding?: "base64" | string | null }
  ) => {
    const fsPath = toFsPath(value);
    await fsProm.mkdir(pathNode.dirname(fsPath), { recursive: true });
    const buffer =
      options?.encoding === "base64" ? Buffer.from(data, "base64") : Buffer.from(data, "utf8");
    await fsProm.writeFile(fsPath, buffer);
  };

  const copyAsync = async ({ from, to }: { from: string; to: string }) => {
    const fromPath = toFsPath(from);
    const toPath = toFsPath(to);
    await fsProm.mkdir(pathNode.dirname(toPath), { recursive: true });
    await fsProm.copyFile(fromPath, toPath);
  };

  const deleteAsync = async (value: string, options?: { idempotent?: boolean }) => {
    const fsPath = toFsPath(value);
    if (options?.idempotent && !fsNode.existsSync(fsPath)) {
      return;
    }
    await fsProm.rm(fsPath, { recursive: true, force: options?.idempotent ?? false });
  };

  const moduleMock: Record<string, unknown> = {
    documentDirectory: `${pathToFileURL(fixedRootPath).href}${pathToFileURL(fixedRootPath).href.endsWith("/") ? "" : "/"}`,
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
    documentDirectory: moduleMock.documentDirectory,
    EncodingType: moduleMock.EncodingType,
    getInfoAsync: moduleMock.getInfoAsync,
    makeDirectoryAsync: moduleMock.makeDirectoryAsync,
    readAsStringAsync: moduleMock.readAsStringAsync,
    writeAsStringAsync: moduleMock.writeAsStringAsync,
    copyAsync: moduleMock.copyAsync,
    deleteAsync: moduleMock.deleteAsync,
    default: moduleMock,
  };
});

jest.mock("@/db/sqlite", () => ({
  DATABASE_NAME: "steuerfuchs.db",
  getDatabase: () => mockGetDatabase(),
  closeDatabase: () => mockCloseDatabase(),
  resetDatabase: () => mockResetDatabase(),
}));

import { createLocalBackupZip, restoreFromBackupZip } from "@/services/backup-restore";

describe("backup/restore integration", () => {
  beforeEach(async () => {
    jest.useRealTimers();
    const fixedRootPath = path.join(os.tmpdir(), `steuerfuchs-backup-int-${process.pid}`);
    fs.rmSync(fixedRootPath, { recursive: true, force: true });
    fs.mkdirSync(fixedRootPath, { recursive: true });
    mockDbState.rootPath = fixedRootPath;
    mockDbState.documentDirectoryUri = `${mockToFileUri(mockDbState.rootPath)}${
      mockToFileUri(mockDbState.rootPath).endsWith("/") ? "" : "/"
    }`;
    mockDbState.dbFilePath = path.join(mockDbState.rootPath, "SQLite", "steuerfuchs.db");
    mockDbState.db = null;
    mockDbState.executor = null;

    mockGetDatabase.mockReset();
    mockCloseDatabase.mockReset();
    mockResetDatabase.mockReset();

    mockGetDatabase.mockImplementation(async () => mockOpenDatabaseWithMigrations());
    mockCloseDatabase.mockImplementation(async () => {
      if (mockDbState.db) {
        mockDbState.db.close();
      }
      mockDbState.db = null;
      mockDbState.executor = null;
    });
    mockResetDatabase.mockImplementation(async () => {
      await mockCloseDatabase();
      if (fs.existsSync(mockDbState.dbFilePath)) {
        fs.unlinkSync(mockDbState.dbFilePath);
      }
    });
  });

  afterEach(async () => {
    await mockCloseDatabase();
    if (mockDbState.rootPath && fs.existsSync(mockDbState.rootPath)) {
      fs.rmSync(mockDbState.rootPath, { recursive: true, force: true });
    }
  });

  it("backs up and restores DB + attachments + manifest + meta with binary integrity", async () => {
    const db = await mockGetDatabase();
    await mockInsertItem(db, "item-1", "Laptop", "2026-01-10");
    await mockInsertItem(db, "item-2", "TV", "2026-02-10");

    const attachmentsDir = path.join(mockDbState.rootPath, "attachments");
    fs.mkdirSync(attachmentsDir, { recursive: true });
    const receiptPath = path.join(attachmentsDir, "receipt-1.pdf");
    const photoPath = path.join(attachmentsDir, "photo-1.jpg");
    fs.writeFileSync(receiptPath, Buffer.from("pdf-binary-1"));
    fs.writeFileSync(photoPath, Buffer.from("photo-binary-1"));

    await mockInsertAttachment(db, {
      id: "att-1",
      itemId: "item-1",
      filePath: mockToFileUri(receiptPath),
      fileSizeBytes: 12,
      type: "RECEIPT",
      mimeType: "application/pdf",
    });
    await mockInsertAttachment(db, {
      id: "att-2",
      itemId: "item-2",
      filePath: mockToFileUri(photoPath),
      fileSizeBytes: 13,
      type: "PHOTO",
      mimeType: "image/jpeg",
    });

    const backup = await createLocalBackupZip();
    expect(backup.sizeBytes).toBeGreaterThan(0);

    const zipBuffer = fs.readFileSync(mockToFsPath(backup.fileUri));
    const zip = await JSZip.loadAsync(zipBuffer);
    expect(zip.file("db/steuerfuchs.db")).toBeTruthy();
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file("meta.json")).toBeTruthy();

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
    expect(manifest.attachmentCount).toBe(2);
    expect(manifest.attachments[0]).toEqual(
      expect.objectContaining({
        itemId: expect.any(String),
        attachmentId: expect.any(String),
        type: expect.any(String),
        mimeType: expect.any(String),
        relativePath: expect.stringContaining("attachments/"),
        fileSizeBytes: expect.any(Number),
      })
    );

    // Simulate local divergence before restore.
    await db.runAsync(`DELETE FROM Attachment;`, []);
    await db.runAsync(`DELETE FROM Item;`, []);
    fs.rmSync(attachmentsDir, { recursive: true, force: true });

    const summary = await restoreFromBackupZip(backup.fileUri);
    expect(summary.itemCountRestored).toBe(2);
    expect(summary.attachmentCountRestored).toBe(2);
    expect(summary.missingFilesCount).toBe(0);

    const restoredDb = await mockGetDatabase();
    const restoredItemCount = (await restoredDb.getFirstAsync(
      `SELECT COUNT(*) AS count FROM Item WHERE DeletedAt IS NULL;`,
      []
    )) as { count: number } | null;
    const restoredAttachments = (await restoredDb.getAllAsync(
      `SELECT FilePath AS filePath FROM Attachment WHERE DeletedAt IS NULL ORDER BY Id ASC;`,
      []
    )) as Array<{ filePath: string }>;
    expect(restoredItemCount?.count).toBe(2);
    expect(restoredAttachments).toHaveLength(2);

    for (const entry of restoredAttachments) {
      const content = fs.readFileSync(mockToFsPath(entry.filePath));
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("fails restore validation when attachment payload is missing and does not overwrite existing local data", async () => {
    const db = await mockGetDatabase();
    await mockInsertItem(db, "item-stable", "Stable Item", "2026-03-10");
    const stableDir = path.join(mockDbState.rootPath, "attachments");
    fs.mkdirSync(stableDir, { recursive: true });
    const stableFile = path.join(stableDir, "stable-receipt.pdf");
    fs.writeFileSync(stableFile, Buffer.from("stable-binary"));
    await mockInsertAttachment(db, {
      id: "att-stable",
      itemId: "item-stable",
      filePath: mockToFileUri(stableFile),
      fileSizeBytes: 12,
      type: "RECEIPT",
      mimeType: "application/pdf",
    });

    const dbBase64 = fs.readFileSync(mockDbState.dbFilePath).toString("base64");
    const invalidZip = new JSZip();
    invalidZip.file("db/steuerfuchs.db", dbBase64, { base64: true });
    invalidZip.file(
      "manifest.json",
      JSON.stringify({
        attachmentCount: 1,
        missingAttachmentCount: 0,
        attachments: [
          {
            itemId: "item-x",
            attachmentId: "att-x",
            type: "PHOTO",
            mimeType: "image/jpeg",
            relativePath: "attachments/missing-photo.jpg",
            fileSizeBytes: 5,
            originalFileName: "missing-photo.jpg",
          },
        ],
      })
    );
    invalidZip.file(
      "meta.json",
      JSON.stringify({
        backupVersion: 1,
        appVersion: "1.0.0",
        schemaVersion: 1,
        databaseName: "steuerfuchs.db",
        createdAt: new Date().toISOString(),
      })
    );
    const invalidUri = mockToFileUri(path.join(mockDbState.rootPath, "exports", "invalid.zip"));
    fs.mkdirSync(path.dirname(mockToFsPath(invalidUri)), { recursive: true });
    fs.writeFileSync(mockToFsPath(invalidUri), await invalidZip.generateAsync({ type: "nodebuffer" }));

    await expect(restoreFromBackupZip(invalidUri)).rejects.toThrow("missing attachment payload");

    const unchangedDb = await mockGetDatabase();
    const itemCount = (await unchangedDb.getFirstAsync(
      `SELECT COUNT(*) AS count FROM Item WHERE DeletedAt IS NULL;`,
      []
    )) as { count: number } | null;
    const attachmentCount = (await unchangedDb.getFirstAsync(
      `SELECT COUNT(*) AS count FROM Attachment WHERE DeletedAt IS NULL;`,
      []
    )) as { count: number } | null;
    expect(itemCount?.count).toBe(1);
    expect(attachmentCount?.count).toBe(1);
    expect(fs.existsSync(stableFile)).toBe(true);
  });
});
