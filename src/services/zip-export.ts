import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";

import type { Category } from "@/models/category";
import type { Item } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import { getAttachmentRepository } from "@/repositories/create-core-repositories";
import { generatePdfExport } from "@/services/pdf-export";

const EXPORT_DIR = `${FileSystem.documentDirectory}exports`;

interface GenerateZipExportParams {
  taxYear: number;
  selectedItems: Item[];
  categories: Category[];
  settings: ProfileSettings;
  includeDetailPages: boolean;
}

export interface ZipExportResult {
  fileUri: string;
  fileName: string;
  sizeBytes: number;
  embeddedPdfName: string;
}

function sanitizePathName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function ensureExportDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }
}

async function readFileAsBase64(fileUri: string): Promise<string> {
  return FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function generateZipExport(
  params: GenerateZipExportParams
): Promise<ZipExportResult> {
  const { taxYear, selectedItems, categories, settings, includeDetailPages } = params;
  if (selectedItems.length === 0) {
    throw new Error("No selected items for ZIP export.");
  }

  const pdf = await generatePdfExport({
    taxYear,
    selectedItems,
    categories,
    settings,
    includeDetailPages,
  });

  const attachmentRepository = await getAttachmentRepository();
  const zip = new JSZip();
  const skippedFiles: string[] = [];

  const pdfBase64 = await readFileAsBase64(pdf.fileUri);
  zip.file(pdf.fileName, pdfBase64, { base64: true });

  for (let index = 0; index < selectedItems.length; index += 1) {
    const item = selectedItems[index];
    const itemFolderName = `${String(index + 1).padStart(3, "0")}-${sanitizePathName(item.title || "item")}`;
    const itemFolder = zip.folder(itemFolderName);
    if (!itemFolder) {
      continue;
    }

    const attachments = await attachmentRepository.listByItem(item.id);
    for (const attachment of attachments) {
      const fallbackName = attachment.filePath.split("/").pop() ?? `${attachment.id}.bin`;
      const fileName = sanitizePathName(attachment.originalFileName ?? fallbackName);
      try {
        const fileBase64 = await readFileAsBase64(attachment.filePath);
        itemFolder.file(fileName, fileBase64, { base64: true });
      } catch {
        skippedFiles.push(`${item.title} -> ${fileName}`);
      }
    }
  }

  if (skippedFiles.length > 0) {
    zip.file(
      "missing-attachments.txt",
      `Some attachment files were missing and skipped:\n${skippedFiles.join("\n")}\n`
    );
  }

  const zipBase64 = await zip.generateAsync({ type: "base64" });
  await ensureExportDirectory();
  const safeTimestamp = new Date().toISOString().replaceAll(":", "-");
  const fileName = `steuerfuchs-export-${taxYear}-${safeTimestamp}.zip`;
  const fileUri = `${EXPORT_DIR}/${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, zipBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(fileUri);
  const sizeBytes = info.exists && typeof info.size === "number" ? info.size : 0;

  return {
    fileUri,
    fileName,
    sizeBytes,
    embeddedPdfName: pdf.fileName,
  };
}

export async function shareExportZip(fileUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Share sheet is not available on this platform.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/zip",
    dialogTitle: "Share SteuerFuchs ZIP export",
    UTI: "public.zip-archive",
  });
}
