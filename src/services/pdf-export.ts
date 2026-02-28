import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import type { Attachment } from "@/models/attachment";
import type { Category } from "@/models/category";
import type { Item } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import { getAttachmentRepository } from "@/repositories/create-core-repositories";
import { formatCents } from "@/utils/money";
import { formatYmdFromDateUtc } from "@/utils/date";

const EXPORT_DIR = `${FileSystem.documentDirectory}exports`;

interface GeneratePdfExportParams {
  taxYear: number;
  selectedItems: Item[];
  categories: Category[];
  settings: ProfileSettings;
  includeDetailPages: boolean;
}

export interface PdfExportResult {
  fileUri: string;
  fileName: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function buildPdfHtml(params: {
  taxYear: number;
  generatedDate: string;
  selectedItems: Item[];
  categories: Category[];
  settings: ProfileSettings;
  attachmentsByItemId: Map<string, Attachment[]>;
  includeDetailPages: boolean;
}): string {
  const {
    taxYear,
    generatedDate,
    selectedItems,
    categories,
    settings,
    attachmentsByItemId,
    includeDetailPages,
  } = params;
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const tableRows = selectedItems
    .map((item) => {
      const categoryName = item.categoryId
        ? categoryMap.get(item.categoryId)?.name ?? "Unknown"
        : "None";
      const workPercent = resolveWorkPercent(item, settings.defaultWorkPercent);
      const deductibleThisYear = computeDeductibleImpactCents(
        item,
        settings,
        categoryMap,
        taxYear
      );

      return `<tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.purchaseDate)}</td>
        <td>${escapeHtml(categoryName)}</td>
        <td>${escapeHtml(formatCents(item.totalCents))}</td>
        <td>${workPercent}%</td>
        <td>${escapeHtml(formatCents(deductibleThisYear))}</td>
      </tr>`;
    })
    .join("");

  const detailSections = includeDetailPages
    ? selectedItems
        .map((item) => {
          const attachments = attachmentsByItemId.get(item.id) ?? [];
          const attachmentLines =
            attachments.length === 0
              ? "<li>No attachments</li>"
              : attachments
                  .map((attachment) => {
                    const name = attachment.originalFileName ?? attachment.filePath.split("/").pop() ?? "Unnamed";
                    return `<li>${escapeHtml(name)} (${escapeHtml(attachment.type)})</li>`;
                  })
                  .join("");

          return `<section class="detail-page">
            <h2>${escapeHtml(item.title)}</h2>
            <p><strong>Purchase date:</strong> ${escapeHtml(item.purchaseDate)}</p>
            <p><strong>Notes:</strong> ${escapeHtml(item.notes?.trim() || "-")}</p>
            <p><strong>Attachments:</strong></p>
            <ul>${attachmentLines}</ul>
          </section>`;
        })
        .join("")
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SteuerFuchs Export ${taxYear}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
      h1 { margin-bottom: 4px; }
      .meta { margin-top: 0; color: #555; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
      th { background: #f2f2f2; }
      .detail-page { page-break-before: always; }
      .detail-page h2 { margin-top: 0; }
    </style>
  </head>
  <body>
    <h1>SteuerFuchs Export</h1>
    <p class="meta">Tax year: ${taxYear} | Generated: ${escapeHtml(generatedDate)} | Items: ${selectedItems.length}</p>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Date</th>
          <th>Category</th>
          <th>Price</th>
          <th>Work %</th>
          <th>Deductible This Year</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    ${detailSections}
  </body>
</html>`;
}

export async function generatePdfExport(
  params: GeneratePdfExportParams
): Promise<PdfExportResult> {
  const { taxYear, selectedItems, categories, settings, includeDetailPages } = params;
  if (selectedItems.length === 0) {
    throw new Error("No selected items for export.");
  }

  const attachmentRepository = await getAttachmentRepository();
  const attachmentLists = await Promise.all(
    selectedItems.map(async (item) => {
      const attachments = await attachmentRepository.listByItem(item.id);
      return { itemId: item.id, attachments };
    })
  );
  const attachmentsByItemId = new Map(
    attachmentLists.map((entry) => [entry.itemId, entry.attachments])
  );

  const generatedDate = formatYmdFromDateUtc(new Date());
  const html = buildPdfHtml({
    taxYear,
    generatedDate,
    selectedItems,
    categories,
    settings,
    attachmentsByItemId,
    includeDetailPages,
  });

  const printResult = await Print.printToFileAsync({ html });
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
