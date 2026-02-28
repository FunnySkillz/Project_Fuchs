import { getDatabase } from "@/db/sqlite";
import {
  SQLiteAttachmentRepository,
  type AttachmentRepository,
} from "@/repositories/attachment-repository";
import {
  SQLiteCategoryRepository,
  type CategoryRepository,
} from "@/repositories/category-repository";
import {
  SQLiteExportRunRepository,
  type ExportRunRepository,
} from "@/repositories/export-run-repository";
import { SQLiteItemRepository, type ItemRepository } from "@/repositories/item-repository";

let itemRepositoryPromise: Promise<ItemRepository> | null = null;
let categoryRepositoryPromise: Promise<CategoryRepository> | null = null;
let attachmentRepositoryPromise: Promise<AttachmentRepository> | null = null;
let exportRunRepositoryPromise: Promise<ExportRunRepository> | null = null;

export function getItemRepository(): Promise<ItemRepository> {
  if (!itemRepositoryPromise) {
    itemRepositoryPromise = getDatabase().then((db) => new SQLiteItemRepository(db));
  }
  return itemRepositoryPromise;
}

export function getCategoryRepository(): Promise<CategoryRepository> {
  if (!categoryRepositoryPromise) {
    categoryRepositoryPromise = getDatabase().then((db) => new SQLiteCategoryRepository(db));
  }
  return categoryRepositoryPromise;
}

export function getAttachmentRepository(): Promise<AttachmentRepository> {
  if (!attachmentRepositoryPromise) {
    attachmentRepositoryPromise = getDatabase().then((db) => new SQLiteAttachmentRepository(db));
  }
  return attachmentRepositoryPromise;
}

export function getExportRunRepository(): Promise<ExportRunRepository> {
  if (!exportRunRepositoryPromise) {
    exportRunRepositoryPromise = getDatabase().then((db) => new SQLiteExportRunRepository(db));
  }
  return exportRunRepositoryPromise;
}
