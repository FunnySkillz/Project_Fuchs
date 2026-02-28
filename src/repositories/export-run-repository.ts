import * as Crypto from "expo-crypto";

import type { SQLiteExecutor } from "@/db/profile-settings-db";
import type { ExportRun, ExportRunOutputType } from "@/models/export-run";

interface ExportRunRow {
  id: string;
  taxYear: number;
  itemCount: number;
  totalDeductibleCents: number;
  estimatedRefundCents: number;
  outputType: ExportRunOutputType;
  outputFilePath: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateExportRunInput {
  taxYear: number;
  itemCount: number;
  totalDeductibleCents: number;
  estimatedRefundCents: number;
  outputType: ExportRunOutputType;
  outputFilePath?: string | null;
}

export interface ExportRunListOptions {
  includeDeleted?: boolean;
}

export interface ExportRunRepository {
  create(input: CreateExportRunInput): Promise<ExportRun>;
  listByYear(taxYear: number, options?: ExportRunListOptions): Promise<ExportRun[]>;
}

function mapExportRunRow(row: ExportRunRow): ExportRun {
  return {
    id: row.id,
    taxYear: row.taxYear,
    itemCount: row.itemCount,
    totalDeductibleCents: row.totalDeductibleCents,
    estimatedRefundCents: row.estimatedRefundCents,
    outputType: row.outputType,
    outputFilePath: row.outputFilePath,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export class SQLiteExportRunRepository implements ExportRunRepository {
  constructor(private readonly db: SQLiteExecutor) {}

  async create(input: CreateExportRunInput): Promise<ExportRun> {
    const id = Crypto.randomUUID();
    await this.db.runAsync(
      `INSERT INTO ExportRun (
        Id,
        TaxYear,
        ItemCount,
        TotalDeductibleCents,
        EstimatedRefundCents,
        OutputType,
        OutputFilePath
      ) VALUES (
        $id,
        $taxYear,
        $itemCount,
        $totalDeductibleCents,
        $estimatedRefundCents,
        $outputType,
        $outputFilePath
      );`,
      {
        $id: id,
        $taxYear: input.taxYear,
        $itemCount: input.itemCount,
        $totalDeductibleCents: input.totalDeductibleCents,
        $estimatedRefundCents: input.estimatedRefundCents,
        $outputType: input.outputType,
        $outputFilePath: input.outputFilePath ?? null,
      }
    );

    const created = await this.db.getFirstAsync<ExportRunRow>(
      `SELECT
        Id AS id,
        TaxYear AS taxYear,
        ItemCount AS itemCount,
        TotalDeductibleCents AS totalDeductibleCents,
        EstimatedRefundCents AS estimatedRefundCents,
        OutputType AS outputType,
        OutputFilePath AS outputFilePath,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt,
        DeletedAt AS deletedAt
      FROM ExportRun
      WHERE Id = $id
      LIMIT 1;`,
      { $id: id }
    );
    if (!created) {
      throw new Error("Failed to create export run.");
    }
    return mapExportRunRow(created);
  }

  async listByYear(taxYear: number, options: ExportRunListOptions = {}): Promise<ExportRun[]> {
    const whereDeletedClause = options.includeDeleted ? "" : "AND DeletedAt IS NULL";
    const rows = await this.db.getAllAsync<ExportRunRow>(
      `SELECT
        Id AS id,
        TaxYear AS taxYear,
        ItemCount AS itemCount,
        TotalDeductibleCents AS totalDeductibleCents,
        EstimatedRefundCents AS estimatedRefundCents,
        OutputType AS outputType,
        OutputFilePath AS outputFilePath,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt,
        DeletedAt AS deletedAt
      FROM ExportRun
      WHERE TaxYear = $taxYear ${whereDeletedClause}
      ORDER BY CreatedAt DESC;`,
      { $taxYear: taxYear }
    );
    return rows.map(mapExportRunRow);
  }
}
