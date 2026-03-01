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
const MANIFEST_FILE = "manifest.json";
const META_FILE = "meta.json";
const BACKUP_VERSION = 1;
const SUPPORTED_SCHEMA_VERSION = 1;
const LEGACY_MANIFEST_FILES = ["backup-manifest.json", "attachments-manifest.json"];

interface AttachmentManifestRow {
  itemId: string;
  attachmentId: string;
  type: string;
  mimeType: string;
  filePath: string;
  originalFileName: string | null;
  fileSizeBytes: number | null;
}

export interface BackupManifestEntry {
  itemId: string;
  attachmentId: string;
  type: string;
  mimeType: string;
  relativePath: string;
  fileSizeBytes: number | null;
  originalFileName: string | null;
}

export interface BackupManifest {
  attachmentCount: number;
  missingAttachmentCount: number;
  attachments: BackupManifestEntry[];
}

export interface BackupMeta {
  backupVersion: number;
  appVersion: string;
  schemaVersion: number;
  databaseName: string;
  createdAt: string;
}

export interface BackupExportResult {
  fileUri: string;
  fileName: string;
  sizeBytes: number;
  manifest: BackupManifest;
  meta: BackupMeta;
}

export interface RestoreResultSummary {
  itemCountRestored: number;
  attachmentCountRestored: number;
  missingFilesCount: number;
}

function ensureDocumentDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is not available.");
  }
  return FileSystem.documentDirectory;
}

function resolveAppVersion(): string {
  const envVersion = process.env.EXPO_PUBLIC_APP_VERSION ?? process.env.npm_package_version;
  if (typeof envVersion === "string" && envVersion.trim().length > 0) {
    return envVersion.trim();
  }
  return "unknown";
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

function buildManifestRelativePath(row: AttachmentManifestRow): string {
  const sourceName = fileNameFromPath(row.filePath);
  const extension = extensionFromFileName(sourceName);
  const safeId = sanitizePathSegment(row.attachmentId);
  return `attachments/${safeId}${extension || ".bin"}`;
}

function buildRestoredFileNameFromRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() ?? "";
  const sanitized = sanitizePathSegment(fileName);
  if (!sanitized) {
    throw new Error(`Invalid attachment relative path in manifest: ${relativePath}`);
  }
  return sanitized;
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

async function ensureParentDirectory(path: string): Promise<void> {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return;
  }
  const parent = normalized.slice(0, lastSlash);
  const parentInfo = await FileSystem.getInfoAsync(parent);
  if (!parentInfo.exists) {
    await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
  }
}

async function buildManifestEntries(): Promise<{
  manifest: BackupManifest;
  entryLookup: Map<string, string>;
}> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AttachmentManifestRow>(
    `SELECT
      ItemId AS itemId,
      Id AS attachmentId,
      Type AS type,
      MimeType AS mimeType,
      FilePath AS filePath,
      OriginalFileName AS originalFileName,
      FileSizeBytes AS fileSizeBytes
     FROM Attachment
     WHERE DeletedAt IS NULL
     ORDER BY ItemId ASC, CreatedAt ASC;`,
    []
  );

  const entryLookup = new Map<string, string>();
  const entries: BackupManifestEntry[] = [];
  let missingAttachmentCount = 0;

  for (const row of rows) {
    const relativePath = buildManifestRelativePath(row);
    entryLookup.set(row.attachmentId, row.filePath);
    entries.push({
      itemId: row.itemId,
      attachmentId: row.attachmentId,
      type: row.type,
      mimeType: row.mimeType,
      relativePath,
      fileSizeBytes: row.fileSizeBytes,
      originalFileName: row.originalFileName,
    });
    const exists = await attachmentFileExists(row.filePath);
    if (!exists) {
      missingAttachmentCount += 1;
    }
  }

  return {
    manifest: {
      attachmentCount: entries.length,
      missingAttachmentCount,
      attachments: entries,
    },
    entryLookup,
  };
}

function parseJsonOrThrow<T>(input: string, errorMessage: string): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    throw new Error(errorMessage);
  }
}

function parseMeta(rawMeta: string): BackupMeta {
  const meta = parseJsonOrThrow<Partial<BackupMeta>>(rawMeta, "Backup meta.json is invalid JSON.");
  if (!meta || typeof meta !== "object") {
    throw new Error("Backup meta.json is invalid.");
  }
  if (typeof meta.schemaVersion !== "number") {
    throw new Error("Backup meta.json is missing schemaVersion.");
  }
  if (meta.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported backup schema version (${String(meta.schemaVersion)}). Expected ${String(SUPPORTED_SCHEMA_VERSION)}.`
    );
  }
  if (typeof meta.databaseName !== "string" || meta.databaseName.trim().length === 0) {
    throw new Error("Backup meta.json is missing databaseName.");
  }
  if (typeof meta.createdAt !== "string" || meta.createdAt.trim().length === 0) {
    throw new Error("Backup meta.json is missing createdAt.");
  }
  if (typeof meta.appVersion !== "string" || meta.appVersion.trim().length === 0) {
    throw new Error("Backup meta.json is missing appVersion.");
  }

  return {
    backupVersion:
      typeof meta.backupVersion === "number" ? meta.backupVersion : BACKUP_VERSION,
    appVersion: meta.appVersion,
    schemaVersion: meta.schemaVersion,
    databaseName: meta.databaseName,
    createdAt: meta.createdAt,
  };
}

function parseManifest(rawManifest: string): BackupManifest {
  const manifest = parseJsonOrThrow<Partial<BackupManifest>>(
    rawManifest,
    "Backup manifest.json is invalid JSON."
  );
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Backup manifest.json is invalid.");
  }
  if (!Array.isArray(manifest.attachments)) {
    throw new Error("Backup manifest.json is missing attachments.");
  }

  for (const entry of manifest.attachments) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Backup manifest entry is invalid.");
    }
    const typed = entry as Partial<BackupManifestEntry>;
    if (
      typeof typed.itemId !== "string" ||
      typeof typed.attachmentId !== "string" ||
      typeof typed.type !== "string" ||
      typeof typed.mimeType !== "string" ||
      typeof typed.relativePath !== "string"
    ) {
      throw new Error("Backup manifest entry is malformed.");
    }
  }

  return {
    attachmentCount:
      typeof manifest.attachmentCount === "number"
        ? manifest.attachmentCount
        : manifest.attachments.length,
    missingAttachmentCount:
      typeof manifest.missingAttachmentCount === "number" ? manifest.missingAttachmentCount : 0,
    attachments: manifest.attachments as BackupManifestEntry[],
  };
}

function resolveRequiredZipEntry(zip: JSZip, fileName: string): JSZip.JSZipObject {
  const entry = zip.file(fileName);
  if (!entry) {
    throw new Error(`Backup ZIP is missing required file: ${fileName}`);
  }
  return entry;
}

function resolveDatabaseEntry(zip: JSZip, expectedDatabaseName: string): JSZip.JSZipObject {
  const direct = zip.file(`db/${expectedDatabaseName}`);
  if (direct) {
    return direct;
  }

  const fallback = Object.values(zip.files).find(
    (entry) =>
      !entry.dir &&
      entry.name.toLowerCase().endsWith(`/${expectedDatabaseName}`.toLowerCase())
  );
  if (!fallback) {
    throw new Error("Backup ZIP does not contain a valid database snapshot.");
  }
  return fallback;
}

function ensureNoLegacyOnlyManifest(zip: JSZip): void {
  const hasManifest = zip.file(MANIFEST_FILE);
  if (hasManifest) {
    return;
  }

  const legacy = LEGACY_MANIFEST_FILES.find((name) => zip.file(name));
  if (legacy) {
    throw new Error(
      "Backup ZIP uses an old manifest format. Create a new backup from the latest app version."
    );
  }
}

function validateManifestAttachmentPayloads(zip: JSZip, manifest: BackupManifest): void {
  for (const entry of manifest.attachments) {
    const payload = zip.file(entry.relativePath);
    if (!payload) {
      throw new Error(
        `Backup ZIP is missing attachment payload: ${entry.attachmentId} (${entry.relativePath})`
      );
    }
  }
}

async function extractBackupToTemp(
  zip: JSZip,
  manifest: BackupManifest,
  databaseName: string
): Promise<{ tempDir: string; tempDbFilePath: string }> {
  const tempDir = `${EXPORT_DIR}/restore-temp-${Date.now()}`;
  await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

  const dbEntry = resolveDatabaseEntry(zip, databaseName);
  const tempDbFilePath = `${tempDir}/${databaseName}`;
  const extractedDbBase64 = await dbEntry.async("base64");
  await FileSystem.writeAsStringAsync(tempDbFilePath, extractedDbBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  for (const entry of manifest.attachments) {
    const zipEntry = zip.file(entry.relativePath);
    if (!zipEntry) {
      throw new Error(
        `Backup ZIP is missing attachment payload: ${entry.attachmentId} (${entry.relativePath})`
      );
    }
    const target = `${tempDir}/${entry.relativePath}`;
    await ensureParentDirectory(target);
    const base64 = await zipEntry.async("base64");
    await FileSystem.writeAsStringAsync(target, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return { tempDir, tempDbFilePath };
}

async function applyRestoredAttachments(
  tempDir: string,
  manifest: BackupManifest
): Promise<void> {
  await deleteAllLocalAttachmentFiles();

  const attachmentRoot = getAttachmentRootDir();
  const rootInfo = await FileSystem.getInfoAsync(attachmentRoot);
  if (!rootInfo.exists) {
    await FileSystem.makeDirectoryAsync(attachmentRoot, { intermediates: true });
  }

  const db = await getDatabase();
  const usedPaths = new Set<string>();
  for (const entry of manifest.attachments) {
    const tempAttachmentPath = `${tempDir}/${entry.relativePath}`;
    const fileName = buildRestoredFileNameFromRelativePath(entry.relativePath);
    let targetPath = buildAttachmentFilePath(fileName);
    while (usedPaths.has(targetPath)) {
      const extension = extensionFromFileName(fileName);
      const base = extension ? fileName.slice(0, -extension.length) : fileName;
      targetPath = buildAttachmentFilePath(`${base}-${usedPaths.size + 1}${extension}`);
    }
    usedPaths.add(targetPath);

    await FileSystem.copyAsync({
      from: tempAttachmentPath,
      to: targetPath,
    });

    await db.runAsync(
      `UPDATE Attachment
       SET FilePath = $filePath
       WHERE Id = $attachmentId;`,
      {
        $attachmentId: entry.attachmentId,
        $filePath: targetPath,
      }
    );
  }
}

async function verifyRestoreResult(): Promise<RestoreResultSummary> {
  const db = await getDatabase();
  const itemCountRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM Item
     WHERE DeletedAt IS NULL;`,
    []
  );
  const attachmentRows = await db.getAllAsync<{ id: string; filePath: string }>(
    `SELECT
      Id AS id,
      FilePath AS filePath
     FROM Attachment
     WHERE DeletedAt IS NULL;`,
    []
  );

  let missingFilesCount = 0;
  for (const attachment of attachmentRows) {
    const exists = await attachmentFileExists(attachment.filePath);
    if (!exists) {
      missingFilesCount += 1;
    }
  }

  return {
    itemCountRestored: itemCountRow?.count ?? 0,
    attachmentCountRestored: attachmentRows.length,
    missingFilesCount,
  };
}

export async function createLocalBackupZip(): Promise<BackupExportResult> {
  await getDatabase();
  await ensureDirectories();

  const { manifest, entryLookup } = await buildManifestEntries();
  const meta: BackupMeta = {
    backupVersion: BACKUP_VERSION,
    appVersion: resolveAppVersion(),
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    databaseName: DATABASE_NAME,
    createdAt: new Date().toISOString(),
  };

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

  for (const entry of manifest.attachments) {
    const sourcePath = entryLookup.get(entry.attachmentId);
    if (!sourcePath) {
      continue;
    }

    const exists = await attachmentFileExists(sourcePath);
    if (!exists) {
      continue;
    }

    const base64 = await FileSystem.readAsStringAsync(sourcePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    zip.file(entry.relativePath, base64, { base64: true });
  }

  zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  zip.file(META_FILE, JSON.stringify(meta, null, 2));

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
    meta,
  };
}

export async function restoreFromBackupZip(
  backupZipUri: string
): Promise<RestoreResultSummary> {
  await ensureDirectories();

  const zipBase64 = await FileSystem.readAsStringAsync(backupZipUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(zipBase64, { base64: true });

  ensureNoLegacyOnlyManifest(zip);
  const metaEntry = resolveRequiredZipEntry(zip, META_FILE);
  const manifestEntry = resolveRequiredZipEntry(zip, MANIFEST_FILE);
  const meta = parseMeta(await metaEntry.async("text"));
  const manifest = parseManifest(await manifestEntry.async("text"));

  validateManifestAttachmentPayloads(zip, manifest);
  const { tempDir, tempDbFilePath } = await extractBackupToTemp(zip, manifest, meta.databaseName);

  try {
    await closeDatabase();
    await resetDatabase();

    const targetDbUri = getDatabaseFileUri();
    await FileSystem.copyAsync({
      from: tempDbFilePath,
      to: targetDbUri,
    });

    await applyRestoredAttachments(tempDir, manifest);
    return await verifyRestoreResult();
  } finally {
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
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
