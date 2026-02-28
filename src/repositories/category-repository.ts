import * as Crypto from "expo-crypto";

import type { SQLiteExecutor } from "@/db/profile-settings-db";
import type { Category } from "@/models/category";

interface CategoryRow {
  id: string;
  name: string;
  sortOrder: number;
  isPreset: number;
  defaultUsefulLifeMonths: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCustomCategoryInput {
  name: string;
  sortOrder?: number;
  defaultUsefulLifeMonths?: number | null;
}

export interface CategoryListOptions {
  includeDeleted?: boolean;
}

export interface CategoryRepository {
  list(options?: CategoryListOptions): Promise<Category[]>;
  createCustomCategory(input: CreateCustomCategoryInput): Promise<Category>;
  softDelete(id: string): Promise<void>;
}

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    isPreset: row.isPreset === 1,
    defaultUsefulLifeMonths: row.defaultUsefulLifeMonths,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export class SQLiteCategoryRepository implements CategoryRepository {
  constructor(private readonly db: SQLiteExecutor) {}

  async list(options: CategoryListOptions = {}): Promise<Category[]> {
    const whereDeletedClause = options.includeDeleted ? "" : "WHERE DeletedAt IS NULL";
    const rows = await this.db.getAllAsync<CategoryRow>(
      `SELECT
        Id AS id,
        Name AS name,
        SortOrder AS sortOrder,
        IsPreset AS isPreset,
        DefaultUsefulLifeMonths AS defaultUsefulLifeMonths,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt,
        DeletedAt AS deletedAt
      FROM Category
      ${whereDeletedClause}
      ORDER BY SortOrder ASC, Name ASC;`,
      []
    );
    return rows.map(mapCategoryRow);
  }

  async createCustomCategory(input: CreateCustomCategoryInput): Promise<Category> {
    const name = input.name.trim();
    if (name.length === 0) {
      throw new Error("Category name is required.");
    }

    const id = Crypto.randomUUID();
    await this.db.runAsync(
      `INSERT INTO Category (
        Id,
        Name,
        SortOrder,
        IsPreset,
        DefaultUsefulLifeMonths
      ) VALUES ($id, $name, $sortOrder, 0, $defaultUsefulLifeMonths);`,
      {
        $id: id,
        $name: name,
        $sortOrder: input.sortOrder ?? 0,
        $defaultUsefulLifeMonths: input.defaultUsefulLifeMonths ?? null,
      }
    );

    const created = await this.db.getFirstAsync<CategoryRow>(
      `SELECT
        Id AS id,
        Name AS name,
        SortOrder AS sortOrder,
        IsPreset AS isPreset,
        DefaultUsefulLifeMonths AS defaultUsefulLifeMonths,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt,
        DeletedAt AS deletedAt
      FROM Category
      WHERE Id = $id
      LIMIT 1;`,
      { $id: id }
    );

    if (!created) {
      throw new Error("Failed to create category.");
    }

    return mapCategoryRow(created);
  }

  async softDelete(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE Category
       SET DeletedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       WHERE Id = $id AND IsPreset = 0 AND DeletedAt IS NULL;`,
      { $id: id }
    );
  }
}
