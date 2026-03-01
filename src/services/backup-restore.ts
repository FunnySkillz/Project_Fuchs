import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";

import { closeDatabase, DATABASE_NAME, getDatabase, resetDatabase } from "@/db/sqlite";
import {
  attachmentFileExists,
  buildAttachmentFilePath,
  deleteAllLocalAttachmentFiles,
  getAttachmentRootDir,
} from "@/services/attachment-storage";

const EXPORT_DIR = `${FileSystem.documentDirectory}exports`;
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite`;
const BACKUP_MANIFEST_FILE = "backup-manifest.json";
const BACKUP_VERSION = 1;
const BACKUP_SCHEMA_VERSION = 1;
const LEGACY_MANIFEST_FILE = "attachments-manifest.json";

interface AttachmentManifestEntry {
  itemId: string;
  attachmentId: string;
  type: string;
  mimeType: string;
  filePath: string;
  exists: boolean;
  originalFileName: string | null;
  archivePath: string;
}

interface BackupManifest {
  backupVersion: number;
  schemaVersion: number;
  generatedAt: string;
  databaseName: string;
  attachmentCount: number;
  missingAttachmentCount: number;
  attachments: AttachmentManifestEntry[];
}

interface AttachmentManifestRow {
  itemId: string;
  attachmentId: string;
  type: string;
  mimeType: string;
  filePath: string;
  originalFileName: string | null;
}

export interface BackupExportResult {
  fileUri: string;
  fileName: string;
  sizeBytes: number;
  manifest: BackupManifest;
}

function ensureDocumentDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is not available.");
  }
  return FileSystem.documentDirectory;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? "";
}

function extensionFromFileName(fileName: string): string {
  const normalized = fileName.trim();
  const index = normalized.lastIndexOf(".");
  if (index <= 0 || index === normalized.length - 1) {
    return "";
  }
  return normalized.slice(index);
}

function buildArchiveAttachmentPath(row: AttachmentManifestRow): string {
  const sourceName = fileNameFromPath(row.filePath);
  const extension = extensionFromFileName(sourceName);
  const safeId = sanitizePathSegment(row.attachmentId);
  const suffix = extension || ".bin";
  return `attachments/${safeId}${suffix}`;
}

function buildRestoredFileName(entry: AttachmentManifestEntry): string {
  const sourceName = sanitizePathSegment(fileNameFromPath(entry.filePath));
  if (sourceName) {
    return sourceName;
  }

  const safeAttachmentId = sanitizePathSegment(entry.attachmentId);
  const extension = extensionFromFileName(entry.archivePath);
  return `${safeAttachmentId}${extension || ".bin"}`;
}

function getDatabaseFileUri(): string {
  ensureDocumentDirectory();
  return `${SQLITE_DIR}/${DATABASE_NAME}`;
}

async function ensureDirectories(): Promise<void> {
  ensureDocumentDirectory();
  const exportsInfo = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!exportsInfo.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }
  const sqliteInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
  if (!sqliteInfo.exists) {
    await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
  }
}

async function buildAttachmentManifest(): Promise<BackupManifest> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AttachmentManifestRow>(
    `SELECT
      ItemId AS itemId,
      Id AS attachmentId,
      Type AS type,
      MimeType AS mimeType,
      FilePath AS filePath,
      OriginalFileName AS originalFileName
     FROM Attachment
     WHERE DeletedAt IS NULL
     ORDER BY ItemId ASC, CreatedAt ASC;`,
    []
  );

  const attachments = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      exists: await attachmentFileExists(row.filePath),
      archivePath: buildArchiveAttachmentPath(row),
    }))
  );
  const missingAttachmentCount = attachments.filter((entry) => !entry.exists).length;

  return {
    backupVersion: BACKUP_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    databaseName: DATABASE_NAME,
    attachmentCount: attachments.length,
    missingAttachmentCount,
    attachments,
  };
}

export async function createLocalBackupZip(): Promise<BackupExportResult> {
  await getDatabase();
  await ensureDirectories();

  const manifest = await buildAttachmentManifest();
  const dbFileUri = getDatabaseFileUri();
  const dbInfo = await FileSystem.getInfoAsync(dbFileUri);
  if (!dbInfo.exists) {
    throw new Error("Database file was not found for backup.");
  }

  const dbBase64 = await FileSystem.readAsStringAsync(dbFileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const zip = new JSZip();
  zip.file(`db/${DATABASE_NAME}`, dbBase64, { base64: true });
  for (const attachment of manifest.attachments) {
    if (!attachment.exists) {
      continue;
    }

    const base64 = await FileSystem.readAsStringAsync(attachment.filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    zip.file(attachment.archivePath, base64, { base64: true });
  }
  zip.file(BACKUP_MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  const zipBase64 = await zip.generateAsync({ type: "base64" });
  const safeTimestamp = new Date().toISOString().replaceAll(":", "-");
  const fileName = `steuerfuchs-backup-${safeTimestamp}.zip`;
  const fileUri = `${EXPORT_DIR}/${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, zipBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const backupInfo = await FileSystem.getInfoAsync(fileUri);
  const sizeBytes = backupInfo.exists && typeof backupInfo.size === "number" ? backupInfo.size : 0;

  return {
    fileUri,
    fileName,
    sizeBytes,
    manifest,
  };
}

function parseManifest(rawManifest: string): BackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawManifest);
  } catch {
    throw new Error("Backup ZIP manifest is invalid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Backup ZIP manifest is invalid.");
  }

  const candidate = parsed as Partial<BackupManifest>;
  const backupVersion = candidate.backupVersion ?? 0;
  if (backupVersion !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup format version (${String(backupVersion)}). Expected ${String(BACKUP_VERSION)}.`
    );
  }
  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported backup schema version (${String(candidate.schemaVersion)}). Expected ${String(BACKUP_SCHEMA_VERSION)}.`
    );
  }
  if (!Array.isArray(candidate.attachments)) {
    throw new Error("Backup ZIP manifest has no attachments array.");
  }

  for (const entry of candidate.attachments) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Backup ZIP manifest attachment entry is invalid.");
    }
    const attachment = entry as Partial<AttachmentManifestEntry>;
    if (
      typeof attachment.attachmentId !== "string" ||
      typeof attachment.itemId !== "string" ||
      typeof attachment.filePath !== "string" ||
      typeof attachment.archivePath !== "string" ||
      typeof attachment.exists !== "boolean"
    ) {
      throw new Error("Backup ZIP manifest attachment entry is malformed.");
    }
  }

  return candidate as BackupManifest;
}

function resolveManifestEntry(zip: JSZip): JSZip.JSZipObject {
  const preferred = zip.file(BACKUP_MANIFEST_FILE);
  if (preferred) {
    return preferred;
  }

  const legacy = zip.file(LEGACY_MANIFEST_FILE);
  if (legacy) {
    throw new Error(
      "Backup ZIP uses an old DB-only manifest format. Create a new full backup from a recent app version."
    );
  }

  throw new Error("Backup ZIP does not contain a backup manifest.");
}

function resolveDatabaseEntry(zip: JSZip): JSZip.JSZipObject {
  const direct = zip.file(`db/${DATABASE_NAME}`);
  if (direct) {
    return direct;
  }

  const fallback = Object.values(zip.files).find(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith(`/${DATABASE_NAME}`.toLowerCase())
  );
  if (!fallback) {
    throw new Error("Backup ZIP does not contain a valid database snapshot.");
  }
  return fallback;
}

function ensureManifestAttachmentEntries(zip: JSZip, manifest: BackupManifest): void {
  for (const entry of manifest.attachments) {
    if (!entry.exists) {
      continue;
    }

    const zipEntry = zip.file(entry.archivePath);
    if (!zipEntry) {
      throw new Error(
        `Backup ZIP attachment entry is missing: ${entry.attachmentId} (${entry.archivePath})`
      );
    }
  }
}

async function restoreAttachmentFiles(zip: JSZip, manifest: BackupManifest): Promise<void> {
  await deleteAllLocalAttachmentFiles();
  const attachmentRoot = getAttachmentRootDir();
  const rootInfo = await FileSystem.getInfoAsync(attachmentRoot);
  if (!rootInfo.exists) {
    await FileSystem.makeDirectoryAsync(attachmentRoot, { intermediates: true });
  }

  const restoredDb = await getDatabase();
  const reservedPaths = new Set<string>();
  for (const entry of manifest.attachments) {
    const fileName = buildRestoredFileName(entry);
    let filePath = buildAttachmentFilePath(fileName);
    while (reservedPaths.has(filePath)) {
      const extension = extensionFromFileName(fileName);
      const stem = extension ? fileName.slice(0, -extension.length) : fileName;
      filePath = buildAttachmentFilePath(`${stem}-${reservedPaths.size + 1}${extension}`);
    }
    reservedPaths.add(filePath);

    if (entry.exists) {
      const zipEntry = zip.file(entry.archivePath);
      if (!zipEntry) {
        throw new Error(`Backup ZIP attachment payload missing for ${entry.attachmentId}.`);
      }

      const base64 = await zipEntry.async("base64");
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    await restoredDb.runAsync(
      `UPDATE Attachment
       SET FilePath = $filePath
       WHERE Id = $attachmentId;`,
      {
        $attachmentId: entry.attachmentId,
        $filePath: filePath,
      }
    );
  }
}

export async function restoreFromBackupZip(backupZipUri: string): Promise<void> {
  await ensureDirectories();

  const zipBase64 = await FileSystem.readAsStringAsync(backupZipUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(zipBase64, { base64: true });
  const manifestEntry = resolveManifestEntry(zip);
  const manifest = parseManifest(await manifestEntry.async("text"));
  ensureManifestAttachmentEntries(zip, manifest);
  const dbEntry = resolveDatabaseEntry(zip);

  const extractedDbBase64 = await dbEntry.async("base64");
  const tempRestoreUri = `${EXPORT_DIR}/restore-${Date.now()}-${DATABASE_NAME}`;
  await FileSystem.writeAsStringAsync(tempRestoreUri, extractedDbBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    await closeDatabase();
    await resetDatabase();

    const targetDbUri = getDatabaseFileUri();
    await FileSystem.copyAsync({
      from: tempRestoreUri,
      to: targetDbUri,
    });

    await restoreAttachmentFiles(zip, manifest);
  } finally {
    await FileSystem.deleteAsync(tempRestoreUri, { idempotent: true });
  }
}

export async function shareBackupZip(fileUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Share sheet is not available on this platform.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/zip",
    dialogTitle: "Share SteuerFuchs backup ZIP",
    UTI: "public.zip-archive",
  });
}
