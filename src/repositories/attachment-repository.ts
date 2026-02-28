import * as Crypto from "expo-crypto";

import type { SQLiteExecutor } from "@/db/profile-settings-db";
import type { Attachment, AttachmentType } from "@/models/attachment";

interface AttachmentRow {
  id: string;
  itemId: string;
  type: AttachmentType;
  mimeType: string;
  filePath: string;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateAttachmentInput {
  itemId: string;
  type: AttachmentType;
  mimeType: string;
  filePath: string;
  originalFileName?: string | null;
  fileSizeBytes?: number | null;
}

export interface AttachmentRepository {
  add(input: CreateAttachmentInput): Promise<Attachment>;
  listByItem(itemId: string): Promise<Attachment[]>;
  delete(id: string): Promise<void>;
}

function mapAttachmentRow(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    itemId: row.itemId,
    type: row.type,
    mimeType: row.mimeType,
    filePath: row.filePath,
    originalFileName: row.originalFileName,
    fileSizeBytes: row.fileSizeBytes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export class SQLiteAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: SQLiteExecutor) {}

  async add(input: CreateAttachmentInput): Promise<Attachment> {
    const id = Crypto.randomUUID();
    await this.db.runAsync(
      `INSERT INTO Attachment (
        Id,
        ItemId,
        Type,
        MimeType,
        FilePath,
        OriginalFileName,
        FileSizeBytes
      ) VALUES ($id, $itemId, $type, $mimeType, $filePath, $originalFileName, $fileSizeBytes);`,
      {
        $id: id,
        $itemId: input.itemId,
        $type: input.type,
        $mimeType: input.mimeType,
        $filePath: input.filePath,
        $originalFileName: input.originalFileName ?? null,
        $fileSizeBytes: input.fileSizeBytes ?? null,
      }
    );

    const created = await this.db.getFirstAsync<AttachmentRow>(
      `SELECT
        Id AS id,
        ItemId AS itemId,
        Type AS type,
        MimeType AS mimeType,
        FilePath AS filePath,
        OriginalFileName AS originalFileName,
        FileSizeBytes AS fileSizeBytes,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt,
        DeletedAt AS deletedAt
      FROM Attachment
      WHERE Id = $id
      LIMIT 1;`,
      { $id: id }
    );
    if (!created) {
      throw new Error("Failed to add attachment.");
    }

    return mapAttachmentRow(created);
  }

  async listByItem(itemId: string): Promise<Attachment[]> {
    const rows = await this.db.getAllAsync<AttachmentRow>(
      `SELECT
        Id AS id,
        ItemId AS itemId,
        Type AS type,
        MimeType AS mimeType,
        FilePath AS filePath,
        OriginalFileName AS originalFileName,
        FileSizeBytes AS fileSizeBytes,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt,
        DeletedAt AS deletedAt
      FROM Attachment
      WHERE ItemId = $itemId AND DeletedAt IS NULL
      ORDER BY CreatedAt ASC;`,
      { $itemId: itemId }
    );
    return rows.map(mapAttachmentRow);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE Attachment
       SET DeletedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       WHERE Id = $id AND DeletedAt IS NULL;`,
      { $id: id }
    );
  }
}
