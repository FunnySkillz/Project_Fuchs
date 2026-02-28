import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";

import { closeDatabase, DATABASE_NAME, getDatabase, resetDatabase } from "@/db/sqlite";
import { attachmentFileExists } from "@/services/attachment-storage";

const EXPORT_DIR = `${FileSystem.documentDirectory}exports`;
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite`;

interface AttachmentManifestEntry {
  itemId: string;
  attachmentId: string;
  type: string;
  mimeType: string;
  filePath: string;
  exists: boolean;
  originalFileName: string | null;
}

interface BackupManifest {
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
    }))
  );
  const missingAttachmentCount = attachments.filter((entry) => !entry.exists).length;

  return {
    schemaVersion: 1,
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
  zip.file("attachments-manifest.json", JSON.stringify(manifest, null, 2));

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

export async function restoreFromBackupZip(backupZipUri: string): Promise<void> {
  await ensureDirectories();

  const zipBase64 = await FileSystem.readAsStringAsync(backupZipUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(zipBase64, { base64: true });
  const dbEntry = Object.values(zip.files).find(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith(`/${DATABASE_NAME}`.toLowerCase())
  );
  if (!dbEntry) {
    throw new Error("Backup ZIP does not contain a valid database snapshot.");
  }

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
