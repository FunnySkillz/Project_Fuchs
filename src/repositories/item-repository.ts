import * as Crypto from "expo-crypto";

import type { SQLiteExecutor } from "@/db/profile-settings-db";
import type { Item, ItemUsageType } from "@/models/item";
import { deleteLocalAttachmentFile } from "@/services/attachment-storage";

interface ItemRow {
  id: string;
  title: string;
  purchaseDate: string;
  totalCents: number;
  currency: string;
  usageType: ItemUsageType;
  workPercent: number | null;
  categoryId: string | null;
  vendor: string | null;
  warrantyMonths: number | null;
  notes: string | null;
  usefulLifeMonthsOverride: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ItemAttachmentFileRow {
  id: string;
  filePath: string;
}

export interface CreateItemInput {
  title: string;
  purchaseDate: string;
  totalCents: number;
  usageType: ItemUsageType;
  workPercent?: number | null;
  categoryId?: string | null;
  vendor?: string | null;
  warrantyMonths?: number | null;
  notes?: string | null;
  usefulLifeMonthsOverride?: number | null;
}

export interface UpdateItemInput extends CreateItemInput {
  id: string;
}

export interface ItemListFilters {
  year?: number;
  usageType?: ItemUsageType;
  categoryId?: string;
  missingReceipt?: boolean;
  missingNotes?: boolean;
}

export interface ItemRepository {
  create(input: CreateItemInput): Promise<Item>;
  update(input: UpdateItemInput): Promise<Item>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Item | null>;
  list(filters?: ItemListFilters): Promise<Item[]>;
}

function mapItemRow(row: ItemRow): Item {
  return {
    id: row.id,
    title: row.title,
    purchaseDate: row.purchaseDate,
    totalCents: row.totalCents,
    currency: row.currency === "EUR" ? "EUR" : "EUR",
    usageType: row.usageType,
    workPercent: row.workPercent,
    categoryId: row.categoryId,
    vendor: row.vendor,
    warrantyMonths: row.warrantyMonths,
    notes: row.notes,
    usefulLifeMonthsOverride: row.usefulLifeMonthsOverride,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export class SQLiteItemRepository implements ItemRepository {
  constructor(private readonly db: SQLiteExecutor) {}

  async create(input: CreateItemInput): Promise<Item> {
    const id = Crypto.randomUUID();
    await this.db.runAsync(
      `INSERT INTO Item (
        Id,
        Title,
        PurchaseDate,
        TotalCents,
        Currency,
        UsageType,
        WorkPercent,
        CategoryId,
        Vendor,
        WarrantyMonths,
        Notes,
        UsefulLifeMonthsOverride
      ) VALUES (
        $id,
        $title,
        $purchaseDate,
        $totalCents,
        'EUR',
        $usageType,
        $workPercent,
        $categoryId,
        $vendor,
        $warrantyMonths,
        $notes,
        $usefulLifeMonthsOverride
      );`,
      {
        $id: id,
        $title: input.title.trim(),
        $purchaseDate: input.purchaseDate,
        $totalCents: input.totalCents,
        $usageType: input.usageType,
        $workPercent: input.workPercent ?? null,
        $categoryId: input.categoryId ?? null,
        $vendor: input.vendor ?? null,
        $warrantyMonths: input.warrantyMonths ?? null,
        $notes: input.notes ?? null,
        $usefulLifeMonthsOverride: input.usefulLifeMonthsOverride ?? null,
      }
    );

    const created = await this.getById(id);
    if (!created) {
      throw new Error("Failed to create item.");
    }
    return created;
  }

  async update(input: UpdateItemInput): Promise<Item> {
    await this.db.runAsync(
      `UPDATE Item
       SET Title = $title,
           PurchaseDate = $purchaseDate,
           TotalCents = $totalCents,
           UsageType = $usageType,
           WorkPercent = $workPercent,
           CategoryId = $categoryId,
           Vendor = $vendor,
           WarrantyMonths = $warrantyMonths,
           Notes = $notes,
           UsefulLifeMonthsOverride = $usefulLifeMonthsOverride
       WHERE Id = $id AND DeletedAt IS NULL;`,
      {
        $id: input.id,
        $title: input.title.trim(),
        $purchaseDate: input.purchaseDate,
        $totalCents: input.totalCents,
        $usageType: input.usageType,
        $workPercent: input.workPercent ?? null,
        $categoryId: input.categoryId ?? null,
        $vendor: input.vendor ?? null,
        $warrantyMonths: input.warrantyMonths ?? null,
        $notes: input.notes ?? null,
        $usefulLifeMonthsOverride: input.usefulLifeMonthsOverride ?? null,
      }
    );

    const updated = await this.getById(input.id);
    if (!updated) {
      throw new Error("Item not found after update.");
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const attachments = await this.db.getAllAsync<ItemAttachmentFileRow>(
      `SELECT
        Id AS id,
        FilePath AS filePath
      FROM Attachment
      WHERE ItemId = $itemId AND DeletedAt IS NULL;`,
      { $itemId: id }
    );

    for (const attachment of attachments) {
      await this.db.runAsync(
        `UPDATE Attachment
         SET DeletedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         WHERE Id = $id AND DeletedAt IS NULL;`,
        { $id: attachment.id }
      );
      await deleteLocalAttachmentFile(attachment.filePath);
    }

    await this.db.runAsync(
      `UPDATE Item
       SET DeletedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       WHERE Id = $id AND DeletedAt IS NULL;`,
      { $id: id }
    );
  }

  async getById(id: string): Promise<Item | null> {
    const row = await this.db.getFirstAsync<ItemRow>(
      `SELECT
        Id AS id,
        Title AS title,
        PurchaseDate AS purchaseDate,
        TotalCents AS totalCents,
        Currency AS currency,
        UsageType AS usageType,
        WorkPercent AS workPercent,
        CategoryId AS categoryId,
        Vendor AS vendor,
        WarrantyMonths AS warrantyMonths,
        Notes AS notes,
        UsefulLifeMonthsOverride AS usefulLifeMonthsOverride,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt,
        DeletedAt AS deletedAt
      FROM Item
      WHERE Id = $id AND DeletedAt IS NULL
      LIMIT 1;`,
      { $id: id }
    );
    return row ? mapItemRow(row) : null;
  }

  async list(filters: ItemListFilters = {}): Promise<Item[]> {
    const clauses: string[] = ["i.DeletedAt IS NULL"];
    const params: Record<string, string | number | null> = {};

    if (filters.year !== undefined) {
      clauses.push("substr(i.PurchaseDate, 1, 4) = $year");
      params.$year = String(filters.year);
    }
    if (filters.usageType !== undefined) {
      clauses.push("i.UsageType = $usageType");
      params.$usageType = filters.usageType;
    }
    if (filters.categoryId !== undefined) {
      clauses.push("i.CategoryId = $categoryId");
      params.$categoryId = filters.categoryId;
    }
    if (filters.missingReceipt) {
      clauses.push(
        `NOT EXISTS (
          SELECT 1
          FROM Attachment a
          WHERE a.ItemId = i.Id
            AND a.Type = 'RECEIPT'
            AND a.DeletedAt IS NULL
        )`
      );
    }
    if (filters.missingNotes) {
      clauses.push("(i.Notes IS NULL OR trim(i.Notes) = '')");
    }

    const rows = await this.db.getAllAsync<ItemRow>(
      `SELECT
        i.Id AS id,
        i.Title AS title,
        i.PurchaseDate AS purchaseDate,
        i.TotalCents AS totalCents,
        i.Currency AS currency,
        i.UsageType AS usageType,
        i.WorkPercent AS workPercent,
        i.CategoryId AS categoryId,
        i.Vendor AS vendor,
        i.WarrantyMonths AS warrantyMonths,
        i.Notes AS notes,
        i.UsefulLifeMonthsOverride AS usefulLifeMonthsOverride,
        i.CreatedAt AS createdAt,
        i.UpdatedAt AS updatedAt,
        i.DeletedAt AS deletedAt
      FROM Item i
      WHERE ${clauses.join(" AND ")}
      ORDER BY i.PurchaseDate DESC, i.CreatedAt DESC;`,
      params
    );

    return rows.map(mapItemRow);
  }
}
