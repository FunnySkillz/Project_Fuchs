export type PdfPageSize = "A4" | "LETTER";
export type PdfImageLayout = "HYBRID";
export type PdfImageQuality = "HIGH" | "BALANCED" | "COMPACT";

export interface PdfRenderOptions {
  pageSize: PdfPageSize;
  imageLayout: PdfImageLayout;
  imageQuality: PdfImageQuality;
}

export interface PdfPrintDimensions {
  width: number;
  height: number;
  cssPageSize: string;
}

export interface PdfTableRow {
  title: string;
  date: string;
  category: string;
  usagePercent: string;
  price: string;
  deductible: string;
}

export interface PdfAttachmentPreview {
  id: string;
  displayName: string;
  type: string;
  mimeType: string;
  fileSizeLabel: string;
  exists: boolean;
  isImage: boolean;
  imageDataUri: string | null;
  embedError: boolean;
}

export interface PdfDetailSection {
  itemId: string;
  title: string;
  purchaseDate: string;
  vendor: string;
  category: string;
  usageLabel: string;
  workPercentLabel: string;
  priceLabel: string;
  deductibleLabel: string;
  warrantyLabel: string;
  notes: string;
  primaryImage: PdfAttachmentPreview | null;
  attachments: PdfAttachmentPreview[];
}

export interface PdfImageAppendixGroup {
  itemId: string;
  itemTitle: string;
  images: PdfAttachmentPreview[];
}

export interface PdfNonImageAttachmentRow {
  itemTitle: string;
  fileName: string;
  attachmentType: string;
  mimeType: string;
  fileSizeLabel: string;
  status: string;
}

export interface PdfDocumentModel {
  appName: string;
  reportTitle: string;
  taxYear: number;
  generatedDateLabel: string;
  generatedAtIso: string;
  locale: string;
  currency: string;
  includeDetailPages: boolean;
  selectedItemsLabel: string;
  deductibleLabel: string;
  refundLabel: string;
  selectedItemCount: number;
  deductibleTotal: string;
  estimatedRefundTotal: string;
  tableRows: PdfTableRow[];
  detailSections: PdfDetailSection[];
  imageAppendixGroups: PdfImageAppendixGroup[];
  nonImageAttachments: PdfNonImageAttachmentRow[];
  disclaimerText: string;
  footerLine: string;
}

export const DEFAULT_PDF_RENDER_OPTIONS: PdfRenderOptions = {
  pageSize: "A4",
  imageLayout: "HYBRID",
  imageQuality: "HIGH",
};

const PAGE_DIMENSIONS: Record<PdfPageSize, PdfPrintDimensions> = {
  A4: {
    width: 595,
    height: 842,
    cssPageSize: "A4",
  },
  LETTER: {
    width: 612,
    height: 792,
    cssPageSize: "Letter",
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAttachmentStatus(attachment: PdfAttachmentPreview): string {
  if (!attachment.exists) {
    return "missing";
  }
  if (attachment.embedError) {
    return "preview unavailable";
  }
  return "ok";
}

function renderImageCard(attachment: PdfAttachmentPreview): string {
  const status = renderAttachmentStatus(attachment);
  const caption = `${attachment.displayName} | ${attachment.type} | ${attachment.fileSizeLabel}`;
  if (!attachment.exists) {
    return `<article class="image-card image-card-missing">
      <div class="image-frame image-placeholder">Image file missing</div>
      <p class="image-caption">${escapeHtml(caption)} | ${escapeHtml(status)}</p>
    </article>`;
  }
  if (!attachment.imageDataUri) {
    return `<article class="image-card image-card-missing">
      <div class="image-frame image-placeholder">Preview unavailable</div>
      <p class="image-caption">${escapeHtml(caption)} | ${escapeHtml(status)}</p>
    </article>`;
  }
  return `<article class="image-card">
    <div class="image-frame">
      <img src="${attachment.imageDataUri}" alt="${escapeHtml(attachment.displayName)}" />
    </div>
    <p class="image-caption">${escapeHtml(caption)}</p>
  </article>`;
}

function renderDetailAttachmentLine(attachment: PdfAttachmentPreview): string {
  const status = renderAttachmentStatus(attachment);
  return `<li>
    <span class="attachment-name">${escapeHtml(attachment.displayName)}</span>
    <span class="attachment-meta">${escapeHtml(attachment.type)} | ${escapeHtml(attachment.mimeType)} | ${escapeHtml(attachment.fileSizeLabel)} | ${escapeHtml(status)}</span>
  </li>`;
}

function renderDetailSection(detail: PdfDetailSection): string {
  const primaryImageMarkup = detail.primaryImage
    ? renderImageCard(detail.primaryImage)
    : `<article class="image-card image-card-missing">
        <div class="image-frame image-placeholder">No image attachment</div>
        <p class="image-caption">No image preview for this item.</p>
      </article>`;

  const attachmentLines =
    detail.attachments.length === 0
      ? `<li>
          <span class="attachment-name">No attachments</span>
          <span class="attachment-meta">No files linked to this item.</span>
        </li>`
      : detail.attachments.map((attachment) => renderDetailAttachmentLine(attachment)).join("");

  return `<section class="detail-card" data-item-id="${escapeHtml(detail.itemId)}">
    <h3>${escapeHtml(detail.title)}</h3>
    <div class="detail-grid">
      <div class="detail-kv"><span class="detail-k">Purchase Date</span><span class="detail-v">${escapeHtml(detail.purchaseDate)}</span></div>
      <div class="detail-kv"><span class="detail-k">Category</span><span class="detail-v">${escapeHtml(detail.category)}</span></div>
      <div class="detail-kv"><span class="detail-k">Vendor</span><span class="detail-v">${escapeHtml(detail.vendor)}</span></div>
      <div class="detail-kv"><span class="detail-k">Usage</span><span class="detail-v">${escapeHtml(detail.usageLabel)}</span></div>
      <div class="detail-kv"><span class="detail-k">Work Share</span><span class="detail-v">${escapeHtml(detail.workPercentLabel)}</span></div>
      <div class="detail-kv"><span class="detail-k">Price</span><span class="detail-v">${escapeHtml(detail.priceLabel)}</span></div>
      <div class="detail-kv"><span class="detail-k">Deductible</span><span class="detail-v">${escapeHtml(detail.deductibleLabel)}</span></div>
      <div class="detail-kv"><span class="detail-k">Warranty</span><span class="detail-v">${escapeHtml(detail.warrantyLabel)}</span></div>
    </div>
    <div class="detail-notes">
      <p class="detail-k">Notes</p>
      <p class="detail-v">${escapeHtml(detail.notes)}</p>
    </div>
    <div class="primary-image-wrap">
      ${primaryImageMarkup}
    </div>
    <div class="detail-attachments">
      <h4>Attachments</h4>
      <ul>${attachmentLines}</ul>
    </div>
  </section>`;
}

function renderTableRows(rows: PdfTableRow[]): string {
  return rows
    .map(
      (row) => `<tr>
        <td class="col-title">${escapeHtml(row.title)}</td>
        <td class="col-date">${escapeHtml(row.date)}</td>
        <td class="col-category">${escapeHtml(row.category)}</td>
        <td class="num col-usage">${escapeHtml(row.usagePercent)}</td>
        <td class="num col-price">${escapeHtml(row.price)}</td>
        <td class="num col-deductible">${escapeHtml(row.deductible)}</td>
      </tr>`
    )
    .join("");
}

function renderDetailPages(model: PdfDocumentModel): string {
  if (!model.includeDetailPages) {
    return "";
  }
  if (model.detailSections.length === 0) {
    return "";
  }
  return `<section class="detail-section">
    <h2>Item Details</h2>
    ${model.detailSections.map((detail) => renderDetailSection(detail)).join("")}
  </section>`;
}

function renderImageAppendix(model: PdfDocumentModel): string {
  if (!model.includeDetailPages) {
    return "";
  }
  const groupMarkup =
    model.imageAppendixGroups.length === 0
      ? `<p class="muted">No image attachments were found for the selected items.</p>`
      : model.imageAppendixGroups
          .map((group) => {
            const cards =
              group.images.length === 0
                ? `<p class="muted">No image attachments available.</p>`
                : `<div class="image-grid">${group.images.map((image) => renderImageCard(image)).join("")}</div>`;
            return `<section class="appendix-group" data-item-id="${escapeHtml(group.itemId)}">
              <h3>${escapeHtml(group.itemTitle)}</h3>
              ${cards}
            </section>`;
          })
          .join("");

  const nonImageRows =
    model.nonImageAttachments.length === 0
      ? `<p class="muted">No non-image attachments.</p>`
      : `<table class="appendix-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>File</th>
              <th>Type</th>
              <th>MIME</th>
              <th class="num">Size</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${model.nonImageAttachments
              .map(
                (row) => `<tr>
                  <td>${escapeHtml(row.itemTitle)}</td>
                  <td>${escapeHtml(row.fileName)}</td>
                  <td>${escapeHtml(row.attachmentType)}</td>
                  <td>${escapeHtml(row.mimeType)}</td>
                  <td class="num">${escapeHtml(row.fileSizeLabel)}</td>
                  <td>${escapeHtml(row.status)}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>`;

  return `<section class="appendix-section">
    <h2>Attachment Appendix</h2>
    <p class="muted">Image previews grouped by item.</p>
    ${groupMarkup}
    <h3>Non-image Attachments</h3>
    ${nonImageRows}
  </section>`;
}

export function normalizePdfRenderOptions(
  options?: Partial<PdfRenderOptions>
): PdfRenderOptions {
  return {
    pageSize: options?.pageSize ?? DEFAULT_PDF_RENDER_OPTIONS.pageSize,
    imageLayout: options?.imageLayout ?? DEFAULT_PDF_RENDER_OPTIONS.imageLayout,
    imageQuality: options?.imageQuality ?? DEFAULT_PDF_RENDER_OPTIONS.imageQuality,
  };
}

export function getPrintDimensionsForPageSize(pageSize: PdfPageSize): PdfPrintDimensions {
  return PAGE_DIMENSIONS[pageSize];
}

export function renderPdfHtml(model: PdfDocumentModel, options: PdfRenderOptions): string {
  const pageConfig = getPrintDimensionsForPageSize(options.pageSize);

  const tableRows = renderTableRows(model.tableRows);
  const detailPages = renderDetailPages(model);
  const imageAppendix = options.imageLayout === "HYBRID" ? renderImageAppendix(model) : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(model.appName)} Export ${model.taxYear}</title>
    <style>
      @page {
        size: ${pageConfig.cssPageSize};
        margin: 24px;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "Helvetica Neue", "Arial", sans-serif;
        color: #0f172a;
        font-size: 12px;
        line-height: 1.45;
      }
      h1, h2, h3, h4, p {
        margin: 0;
      }
      .report-root {
        display: block;
      }
      .header {
        margin-bottom: 24px;
        padding: 16px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        background: #f8fafc;
      }
      .title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .subtitle {
        font-size: 13px;
        color: #334155;
      }
      .meta-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .meta-chip {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #475569;
        font-size: 10px;
      }
      .summary-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 24px;
      }
      .summary-card {
        flex: 1 1 160px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        background: #ffffff;
      }
      .summary-label {
        color: #64748b;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .summary-value {
        color: #0f172a;
        font-size: 18px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .table-wrap {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 24px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .items-table thead {
        display: table-header-group;
      }
      .items-table th {
        background: #f8fafc;
        color: #334155;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 10px 8px;
        border-bottom: 1px solid #cbd5e1;
      }
      .items-table td {
        padding: 9px 8px;
        border-bottom: 1px solid #e2e8f0;
        color: #1e293b;
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      .items-table tbody tr:nth-child(even) td {
        background: #fcfdff;
      }
      .items-table tfoot td {
        background: #f8fafc;
        border-top: 1px solid #cbd5e1;
        font-weight: 700;
      }
      .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .items-table tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .col-title {
        width: 30%;
      }
      .col-date {
        width: 12%;
      }
      .col-category {
        width: 17%;
      }
      .col-usage {
        width: 9%;
      }
      .col-price {
        width: 15%;
      }
      .col-deductible {
        width: 17%;
      }
      .detail-section {
        page-break-before: always;
      }
      .appendix-section {
        page-break-before: always;
      }
      .detail-card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        margin-top: 12px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .detail-card h3 {
        font-size: 16px;
        margin-bottom: 12px;
      }
      .detail-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .detail-kv {
        flex: 1 1 220px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px;
      }
      .detail-k {
        display: block;
        font-size: 10px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 4px;
      }
      .detail-v {
        color: #0f172a;
        font-size: 12px;
      }
      .detail-notes {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px;
        margin-bottom: 12px;
      }
      .primary-image-wrap {
        margin-bottom: 12px;
      }
      .detail-attachments h4 {
        font-size: 12px;
        margin-bottom: 8px;
      }
      .detail-attachments ul {
        margin: 0;
        padding-left: 16px;
      }
      .detail-attachments li {
        margin-bottom: 6px;
      }
      .attachment-name {
        display: block;
        font-weight: 600;
        color: #0f172a;
      }
      .attachment-meta {
        display: block;
        color: #64748b;
        font-size: 10px;
      }
      .appendix-group {
        margin-top: 16px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .appendix-group h3 {
        margin-bottom: 10px;
      }
      .image-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .image-card {
        flex: 1 1 calc(50% - 12px);
        min-width: 200px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 8px;
        background: #ffffff;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .image-card-missing {
        border-style: dashed;
      }
      .image-frame {
        width: 100%;
        height: 220px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        overflow: hidden;
        background: #f8fafc;
      }
      .image-frame img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .image-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        font-size: 11px;
      }
      .image-caption {
        margin-top: 8px;
        font-size: 10px;
        color: #475569;
      }
      .appendix-table {
        margin-top: 8px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
      }
      .appendix-table th {
        background: #f8fafc;
        color: #334155;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 8px 6px;
        border-bottom: 1px solid #cbd5e1;
      }
      .appendix-table td {
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 11px;
      }
      .muted {
        color: #64748b;
        font-size: 11px;
        margin-top: 6px;
      }
      .footer-block {
        margin-top: 24px;
        border-top: 1px solid #e2e8f0;
        padding-top: 12px;
      }
      .disclaimer {
        font-size: 10px;
        color: #475569;
        margin-bottom: 8px;
      }
      .footer-line {
        font-size: 10px;
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <div class="report-root">
      <header class="header">
        <p class="title">${escapeHtml(model.reportTitle)}</p>
        <p class="subtitle">${escapeHtml(model.appName)} | Tax Year ${model.taxYear}</p>
        <div class="meta-strip">
          <span class="meta-chip">Generated: ${escapeHtml(model.generatedDateLabel)}</span>
          <span class="meta-chip">Locale: ${escapeHtml(model.locale)}</span>
          <span class="meta-chip">Currency: ${escapeHtml(model.currency)}</span>
          <span class="meta-chip">Detail pages: ${model.includeDetailPages ? "Yes" : "No"}</span>
          <span class="meta-chip">Timestamp: ${escapeHtml(model.generatedAtIso)}</span>
        </div>
      </header>

      <section class="summary-grid">
        <article class="summary-card">
          <p class="summary-label">${escapeHtml(model.selectedItemsLabel)}</p>
          <p class="summary-value">${escapeHtml(String(model.selectedItemCount))}</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">${escapeHtml(model.deductibleLabel)}</p>
          <p class="summary-value">${escapeHtml(model.deductibleTotal)}</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">${escapeHtml(model.refundLabel)}</p>
          <p class="summary-value">${escapeHtml(model.estimatedRefundTotal)}</p>
        </article>
      </section>

      <section class="table-wrap">
        <table class="items-table">
          <thead>
            <tr>
              <th class="col-title">Title</th>
              <th class="col-date">Date</th>
              <th class="col-category">Category</th>
              <th class="num col-usage">Usage %</th>
              <th class="num col-price">Price</th>
              <th class="num col-deductible">Deductible</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4">Totals</td>
              <td class="num">${escapeHtml(model.deductibleLabel)}</td>
              <td class="num">${escapeHtml(model.deductibleTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      ${detailPages}
      ${imageAppendix}

      <section class="footer-block">
        <p class="disclaimer">${escapeHtml(model.disclaimerText)}</p>
        <p class="footer-line">${escapeHtml(model.footerLine)}</p>
      </section>
    </div>
  </body>
</html>`;
}
