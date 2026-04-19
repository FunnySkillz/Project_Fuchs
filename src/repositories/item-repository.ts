import * as Crypto from "expo-crypto";

import type { SQLiteExecutor } from "@/db/profile-settings-db";
import type {
  Item,
  ItemPurchaseKind,
  ItemUsageType,
  SubscriptionBillingCadence,
} from "@/models/item";

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
  purchaseKind: string | null;
  billingCadence: string | null;
  subscriptionEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
  purchaseKind?: ItemPurchaseKind;
  billingCadence?: SubscriptionBillingCadence | null;
  subscriptionEndDate?: string | null;
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
  includeDeleted?: boolean;
}

export interface GetItemOptions {
  includeDeleted?: boolean;
}

export interface ItemRepository {
  create(input: CreateItemInput): Promise<Item>;
  update(input: UpdateItemInput): Promise<Item>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  getById(id: string, options?: GetItemOptions): Promise<Item | null>;
  list(filters?: ItemListFilters): Promise<Item[]>;
  listMissingReceiptItemIds(filters?: Omit<ItemListFilters, "missingReceipt">): Promise<string[]>;
}

function normalizePurchaseKind(value: ItemPurchaseKind | undefined): ItemPurchaseKind {
  return value === "SUBSCRIPTION" ? "SUBSCRIPTION" : "ONE_TIME";
}

function normalizeBillingCadence(
  purchaseKind: ItemPurchaseKind,
  value: SubscriptionBillingCadence | null | undefined
): SubscriptionBillingCadence | null {
  if (purchaseKind !== "SUBSCRIPTION") {
    return null;
  }
  if (value === "YEARLY") {
    return "YEARLY";
  }
  if (value === "MONTHLY") {
    return "MONTHLY";
  }
  return null;
}

function normalizeSubscriptionEndDate(
  purchaseKind: ItemPurchaseKind,
  value: string | null | undefined
): string | null {
  if (purchaseKind !== "SUBSCRIPTION") {
    return null;
  }
  return value ?? null;
}

function mapPurchaseKind(value: string | null): ItemPurchaseKind {
  return value === "SUBSCRIPTION" ? "SUBSCRIPTION" : "ONE_TIME";
}

function mapBillingCadence(value: string | null): SubscriptionBillingCadence | null {
  if (value === "YEARLY") {
    return "YEARLY";
  }
  if (value === "MONTHLY") {
    return "MONTHLY";
  }
  return null;
}

function mapItemRow(row: ItemRow): Item {
  const purchaseKind = mapPurchaseKind(row.purchaseKind);
  const billingCadence = purchaseKind === "SUBSCRIPTION" ? mapBillingCadence(row.billingCadence) : null;
  const subscriptionEndDate = purchaseKind === "SUBSCRIPTION" ? row.subscriptionEndDate : null;

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
    purchaseKind,
    billingCadence,
    subscriptionEndDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function pushYearClause(
  clauses: string[],
  params: Record<string, string | number | null>,
  year: number
): void {
  params.$yearStart = `${year}-01-01`;
  params.$yearEnd = `${year}-12-31`;
  clauses.push(
    `(
      (
        COALESCE(i.PurchaseKind, 'ONE_TIME') <> 'SUBSCRIPTION'
        AND i.PurchaseDate >= $yearStart
        AND i.PurchaseDate <= $yearEnd
      )
      OR
      (
        COALESCE(i.PurchaseKind, 'ONE_TIME') = 'SUBSCRIPTION'
        AND i.PurchaseDate <= $yearEnd
        AND COALESCE(i.SubscriptionEndDate, '9999-12-31') >= $yearStart
      )
    )`
  );
}

export class SQLiteItemRepository implements ItemRepository {
  constructor(private readonly db: SQLiteExecutor) {}

  async create(input: CreateItemInput): Promise<Item> {
    const id = Crypto.randomUUID();
    const purchaseKind = normalizePurchaseKind(input.purchaseKind);
    const billingCadence = normalizeBillingCadence(purchaseKind, input.billingCadence);
    const subscriptionEndDate = normalizeSubscriptionEndDate(purchaseKind, input.subscriptionEndDate);

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
        UsefulLifeMonthsOverride,
        PurchaseKind,
        BillingCadence,
        SubscriptionEndDate
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
        $usefulLifeMonthsOverride,
        $purchaseKind,
        $billingCadence,
        $subscriptionEndDate
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
        $purchaseKind: purchaseKind,
        $billingCadence: billingCadence,
        $subscriptionEndDate: subscriptionEndDate,
      }
    );

    const created = await this.getById(id);
    if (!created) {
      throw new Error("Failed to create item.");
    }
    return created;
  }

  async update(input: UpdateItemInput): Promise<Item> {
    const purchaseKind = normalizePurchaseKind(input.purchaseKind);
    const billingCadence = normalizeBillingCadence(purchaseKind, input.billingCadence);
    const subscriptionEndDate = normalizeSubscriptionEndDate(purchaseKind, input.subscriptionEndDate);

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
           UsefulLifeMonthsOverride = $usefulLifeMonthsOverride,
           PurchaseKind = $purchaseKind,
           BillingCadence = $billingCadence,
           SubscriptionEndDate = $subscriptionEndDate
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
        $purchaseKind: purchaseKind,
        $billingCadence: billingCadence,
        $subscriptionEndDate: subscriptionEndDate,
      }
    );

    const updated = await this.getById(input.id);
    if (!updated) {
      throw new Error("Item not found after update.");
    }
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE Attachment
       SET DeletedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       WHERE ItemId = $itemId AND DeletedAt IS NULL;`,
      { $itemId: id }
    );
    await this.db.runAsync(
      `UPDATE Item
       SET DeletedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       WHERE Id = $id AND DeletedAt IS NULL;`,
      { $id: id }
    );
  }

  async restore(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE Item
       SET DeletedAt = NULL
       WHERE Id = $id;`,
      { $id: id }
    );

    await this.db.runAsync(
      `UPDATE Attachment
       SET DeletedAt = NULL
       WHERE ItemId = $itemId;`,
      { $itemId: id }
    );
  }

  async getById(id: string, options: GetItemOptions = {}): Promise<Item | null> {
    const whereDeletedClause = options.includeDeleted ? "" : "AND DeletedAt IS NULL";
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
        PurchaseKind AS purchaseKind,
        BillingCadence AS billingCadence,
        SubscriptionEndDate AS subscriptionEndDate,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt,
        DeletedAt AS deletedAt
      FROM Item
      WHERE Id = $id ${whereDeletedClause}
      LIMIT 1;`,
      { $id: id }
    );
    return row ? mapItemRow(row) : null;
  }

  async list(filters: ItemListFilters = {}): Promise<Item[]> {
    const clauses: string[] = [];
    const params: Record<string, string | number | null> = {};

    if (!filters.includeDeleted) {
      clauses.push("i.DeletedAt IS NULL");
    }

    if (filters.year !== undefined) {
      pushYearClause(clauses, params, filters.year);
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
        i.PurchaseKind AS purchaseKind,
        i.BillingCadence AS billingCadence,
        i.SubscriptionEndDate AS subscriptionEndDate,
        i.CreatedAt AS createdAt,
        i.UpdatedAt AS updatedAt,
        i.DeletedAt AS deletedAt
      FROM Item i
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY i.PurchaseDate DESC, i.CreatedAt DESC;`,
      params
    );

    return rows.map(mapItemRow);
  }

  async listMissingReceiptItemIds(
    filters: Omit<ItemListFilters, "missingReceipt"> = {}
  ): Promise<string[]> {
    const clauses: string[] = [
      `NOT EXISTS (
        SELECT 1
        FROM Attachment a
        WHERE a.ItemId = i.Id
          AND a.Type = 'RECEIPT'
          AND a.DeletedAt IS NULL
      )`,
    ];
    const params: Record<string, string | number | null> = {};

    if (!filters.includeDeleted) {
      clauses.push("i.DeletedAt IS NULL");
    }
    if (filters.year !== undefined) {
      pushYearClause(clauses, params, filters.year);
    }
    if (filters.usageType !== undefined) {
      clauses.push("i.UsageType = $usageType");
      params.$usageType = filters.usageType;
    }
    if (filters.categoryId !== undefined) {
      clauses.push("i.CategoryId = $categoryId");
      params.$categoryId = filters.categoryId;
    }
    if (filters.missingNotes) {
      clauses.push("(i.Notes IS NULL OR trim(i.Notes) = '')");
    }

    const rows = await this.db.getAllAsync<{ id: string }>(
      `SELECT i.Id AS id
      FROM Item i
      WHERE ${clauses.join(" AND ")};`,
      params
    );
    return rows.map((row) => row.id);
  }
}
