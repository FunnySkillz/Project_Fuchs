import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import { getLocaleForLanguage } from "@/i18n/translate";
import type { Attachment } from "@/models/attachment";
import type { Category } from "@/models/category";
import type { Item } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import { getAttachmentRepository } from "@/repositories/create-core-repositories";
import {
  attachmentFileExists,
  resolveAttachmentPreviewUri,
} from "@/services/attachment-storage";
import {
  getPrintDimensionsForPageSize,
  normalizePdfRenderOptions,
  renderPdfHtml,
  type PdfAttachmentPreview,
  type PdfDetailSection,
  type PdfDocumentModel,
  type PdfImageAppendixGroup,
  type PdfNonImageAttachmentRow,
  type PdfRenderOptions,
  type PdfTableRow,
} from "@/services/pdf-export-template";
import { getCachedLanguagePreference } from "@/services/language-preference";
import { formatCents } from "@/utils/money";
import { formatYmdFromDateUtc } from "@/utils/date";

type AttachmentWithExistence = Attachment & { __exists: boolean };

const EXPORT_DIR = `${FileSystem.documentDirectory}exports`;
const HIGH_QUALITY_IMAGE_MAX_BYTES = 18 * 1024 * 1024;
const BALANCED_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

interface GeneratePdfExportParams {
  taxYear: number;
  selectedItems: Item[];
  categories: Category[];
  settings: ProfileSettings;
  includeDetailPages: boolean;
  renderOptions?: Partial<PdfRenderOptions>;
}

export interface PdfExportResult {
  fileUri: string;
  fileName: string;
}

function resolveWorkPercent(item: Item, defaultWorkPercent: number): number {
  if (item.usageType === "WORK") {
    return 100;
  }
  if (item.usageType === "PRIVATE" || item.usageType === "OTHER") {
    return 0;
  }
  return Math.max(0, Math.min(100, item.workPercent ?? defaultWorkPercent));
}

async function ensureExportDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function getAttachmentDisplayName(attachment: AttachmentWithExistence): string {
  return attachment.originalFileName ?? attachment.filePath.split("/").pop() ?? "Unnamed";
}

function formatFileSizeLabel(fileSizeBytes: number | null): string {
  if (!fileSizeBytes || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return "Unknown size";
  }
  if (fileSizeBytes < 1024) {
    return `${Math.round(fileSizeBytes)} B`;
  }
  if (fileSizeBytes < 1024 * 1024) {
    return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferMimeTypeFromPath(path: string, fallbackMimeType: string): string {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerPath.endsWith(".png")) {
    return "image/png";
  }
  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowerPath.endsWith(".gif")) {
    return "image/gif";
  }
  return fallbackMimeType;
}

function imageShouldUsePreviewByMime(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return normalized === "image/heic" || normalized === "image/heif";
}

async function resolveAttachmentFileSize(attachment: AttachmentWithExistence): Promise<number | null> {
  if (attachment.fileSizeBytes && attachment.fileSizeBytes > 0) {
    return attachment.fileSizeBytes;
  }
  if (!attachment.__exists) {
    return null;
  }
  const info = await FileSystem.getInfoAsync(attachment.filePath);
  if (!info.exists || typeof info.size !== "number") {
    return null;
  }
  return info.size;
}

async function readImageAsDataUri(filePath: string, mimeType: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeType};base64,${base64}`;
}

async function resolveImageSourcePath(
  attachment: AttachmentWithExistence,
  imageQuality: PdfRenderOptions["imageQuality"]
): Promise<string> {
  if (imageQuality === "COMPACT") {
    return resolveAttachmentPreviewUri(attachment.filePath, attachment.mimeType);
  }

  if (imageShouldUsePreviewByMime(attachment.mimeType)) {
    return resolveAttachmentPreviewUri(attachment.filePath, attachment.mimeType);
  }

  const fileSizeBytes = await resolveAttachmentFileSize(attachment);
  if (!fileSizeBytes) {
    return attachment.filePath;
  }

  const maxBytes = imageQuality === "HIGH" ? HIGH_QUALITY_IMAGE_MAX_BYTES : BALANCED_IMAGE_MAX_BYTES;
  if (fileSizeBytes > maxBytes) {
    return resolveAttachmentPreviewUri(attachment.filePath, attachment.mimeType);
  }

  return attachment.filePath;
}

async function buildAttachmentPreview(
  attachment: AttachmentWithExistence,
  imageQuality: PdfRenderOptions["imageQuality"]
): Promise<PdfAttachmentPreview> {
  const fileSizeBytes = await resolveAttachmentFileSize(attachment);
  const preview: PdfAttachmentPreview = {
    id: attachment.id,
    displayName: getAttachmentDisplayName(attachment),
    type: attachment.type,
    mimeType: attachment.mimeType,
    fileSizeLabel: formatFileSizeLabel(fileSizeBytes),
    exists: attachment.__exists,
    isImage: isImageMimeType(attachment.mimeType),
    imageDataUri: null,
    embedError: false,
  };

  if (!preview.exists || !preview.isImage) {
    return preview;
  }

  let sourcePath = await resolveImageSourcePath(attachment, imageQuality);
  let sourceMime = inferMimeTypeFromPath(sourcePath, attachment.mimeType);

  try {
    preview.imageDataUri = await readImageAsDataUri(sourcePath, sourceMime);
    return preview;
  } catch (error) {
    const fallbackPath = await resolveAttachmentPreviewUri(attachment.filePath, attachment.mimeType);
    if (fallbackPath !== sourcePath) {
      sourcePath = fallbackPath;
      sourceMime = inferMimeTypeFromPath(sourcePath, "image/jpeg");
      try {
        preview.imageDataUri = await readImageAsDataUri(sourcePath, sourceMime);
        return preview;
      } catch (fallbackError) {
        console.warn("Failed to embed attachment preview image", fallbackError);
      }
    } else {
      console.warn("Failed to embed attachment image", error);
    }
  }

  preview.embedError = true;
  return preview;
}

function buildUsageLabel(item: Item, workPercent: number): string {
  if (item.usageType === "MIXED") {
    return `MIXED (${workPercent}%)`;
  }
  return item.usageType;
}

function formatGeneratedDateLabel(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    const hour = String(date.getUTCHours()).padStart(2, "0");
    const minute = String(date.getUTCMinutes()).padStart(2, "0");
    return `${formatYmdFromDateUtc(date)} ${hour}:${minute} UTC`;
  }
}

async function buildPdfDocumentModel(params: {
  taxYear: number;
  generatedAt: Date;
  selectedItems: Item[];
  categories: Category[];
  settings: ProfileSettings;
  attachmentsByItemId: Map<string, AttachmentWithExistence[]>;
  includeDetailPages: boolean;
  renderOptions: PdfRenderOptions;
}): Promise<PdfDocumentModel> {
  const {
    taxYear,
    generatedAt,
    selectedItems,
    categories,
    settings,
    attachmentsByItemId,
    includeDetailPages,
    renderOptions,
  } = params;
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const language = getCachedLanguagePreference();
  const locale = getLocaleForLanguage(language);

  const deductibleByItemId = new Map<string, number>();
  const tableRows: PdfTableRow[] = [];

  for (const item of selectedItems) {
    const categoryName = item.categoryId
      ? categoryMap.get(item.categoryId)?.name ?? "Unknown"
      : "None";
    const workPercent = resolveWorkPercent(item, settings.defaultWorkPercent);
    const deductibleThisYear = computeDeductibleImpactCents(item, settings, categoryMap, taxYear);
    deductibleByItemId.set(item.id, deductibleThisYear);
    tableRows.push({
      title: item.title,
      date: item.purchaseDate,
      category: categoryName,
      usagePercent: `${workPercent}%`,
      price: formatCents(item.totalCents),
      deductible: formatCents(deductibleThisYear),
    });
  }

  const deductibleTotalCents = selectedItems.reduce(
    (sum, item) => sum + (deductibleByItemId.get(item.id) ?? 0),
    0
  );
  const estimatedRefundCents = Math.round(
    (deductibleTotalCents * settings.marginalRateBps) / 10_000
  );

  const detailSections: PdfDetailSection[] = [];
  const imageAppendixGroups: PdfImageAppendixGroup[] = [];
  const nonImageAttachments: PdfNonImageAttachmentRow[] = [];

  if (includeDetailPages) {
    const attachmentPreviewEntries = await Promise.all(
      selectedItems.map(async (item) => {
        const attachments = attachmentsByItemId.get(item.id) ?? [];
        const previews = await Promise.all(
          attachments.map((attachment) => buildAttachmentPreview(attachment, renderOptions.imageQuality))
        );
        return [item.id, previews] as const;
      })
    );
    const previewsByItemId = new Map(attachmentPreviewEntries);

    for (const item of selectedItems) {
      const categoryName = item.categoryId
        ? categoryMap.get(item.categoryId)?.name ?? "Unknown"
        : "None";
      const workPercent = resolveWorkPercent(item, settings.defaultWorkPercent);
      const previews = previewsByItemId.get(item.id) ?? [];
      const imageAttachments = previews.filter((preview) => preview.isImage);
      const nonImageForItem = previews.filter((preview) => !preview.isImage);
      const primaryImage =
        imageAttachments.find((preview) => preview.exists && preview.imageDataUri) ??
        imageAttachments[0] ??
        null;

      detailSections.push({
        itemId: item.id,
        title: item.title,
        purchaseDate: item.purchaseDate,
        vendor: item.vendor?.trim() || "-",
        category: categoryName,
        usageLabel: buildUsageLabel(item, workPercent),
        workPercentLabel: `${workPercent}%`,
        priceLabel: formatCents(item.totalCents),
        deductibleLabel: formatCents(deductibleByItemId.get(item.id) ?? 0),
        warrantyLabel:
          item.warrantyMonths && item.warrantyMonths > 0 ? `${item.warrantyMonths} months` : "None",
        notes: item.notes?.trim() || "-",
        primaryImage,
        attachments: previews,
      });

      if (imageAttachments.length > 0) {
        imageAppendixGroups.push({
          itemId: item.id,
          itemTitle: item.title,
          images: imageAttachments,
        });
      }

      for (const attachment of nonImageForItem) {
        nonImageAttachments.push({
          itemTitle: item.title,
          fileName: attachment.displayName,
          attachmentType: attachment.type,
          mimeType: attachment.mimeType,
          fileSizeLabel: attachment.fileSizeLabel,
          status: attachment.exists ? "ok" : "missing",
        });
      }
    }
  }

  return {
    appName: "SteuerFuchs",
    reportTitle: "Tax Export Report",
    taxYear,
    generatedDateLabel: formatGeneratedDateLabel(generatedAt, locale),
    generatedAtIso: generatedAt.toISOString(),
    locale,
    currency: "EUR",
    includeDetailPages,
    selectedItemsLabel: "Selected Items",
    deductibleLabel: "Deductible This Year",
    refundLabel: "Estimated Refund",
    selectedItemCount: selectedItems.length,
    deductibleTotal: formatCents(deductibleTotalCents),
    estimatedRefundTotal: formatCents(estimatedRefundCents),
    tableRows,
    detailSections,
    imageAppendixGroups,
    nonImageAttachments,
    disclaimerText:
      "This document is generated from local app data and is not legal or tax advice. Please review all entries before filing.",
    footerLine: `Generated by SteuerFuchs | Tax year ${taxYear}`,
  };
}

export async function generatePdfExport(
  params: GeneratePdfExportParams
): Promise<PdfExportResult> {
  const { taxYear, selectedItems, categories, settings, includeDetailPages } = params;
  const renderOptions = normalizePdfRenderOptions(params.renderOptions);
  if (selectedItems.length === 0) {
    throw new Error("No selected items for export.");
  }

  const attachmentRepository = await getAttachmentRepository();
  const attachmentLists = await Promise.all(
    selectedItems.map(async (item) => {
      const attachments = await attachmentRepository.listByItem(item.id);
      const withExistence = await Promise.all(
        attachments.map(async (attachment) => ({
          ...attachment,
          __exists: await attachmentFileExists(attachment.filePath),
        }))
      );
      return { itemId: item.id, attachments: withExistence };
    })
  );
  const attachmentsByItemId = new Map(
    attachmentLists.map((entry) => [entry.itemId, entry.attachments])
  );

  const generatedAt = new Date();
  const documentModel = await buildPdfDocumentModel({
    taxYear,
    generatedAt,
    selectedItems,
    categories,
    settings,
    attachmentsByItemId,
    includeDetailPages,
    renderOptions,
  });
  const html = renderPdfHtml(documentModel, renderOptions);
  const printDimensions = getPrintDimensionsForPageSize(renderOptions.pageSize);

  const printResult = await Print.printToFileAsync({
    html,
    width: printDimensions.width,
    height: printDimensions.height,
  });
  await ensureExportDirectory();

  const safeTimestamp = new Date().toISOString().replaceAll(":", "-");
  const fileName = `steuerfuchs-export-${taxYear}-${safeTimestamp}.pdf`;
  const fileUri = `${EXPORT_DIR}/${fileName}`;
  await FileSystem.copyAsync({
    from: printResult.uri,
    to: fileUri,
  });

  return {
    fileUri,
    fileName,
  };
}

export async function shareExportPdf(fileUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Share sheet is not available on this platform.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/pdf",
    dialogTitle: "Share SteuerFuchs PDF export",
    UTI: "com.adobe.pdf",
  });
}
