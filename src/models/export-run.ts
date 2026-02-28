import type { RecordMetadata } from "@/models/record-metadata";

export type ExportRunOutputType = "PDF" | "ZIP" | "PDF+ZIP";

export interface ExportRun extends RecordMetadata {
  id: string;
  taxYear: number;
  itemCount: number;
  totalDeductibleCents: number;
  estimatedRefundCents: number;
  outputType: ExportRunOutputType;
  outputFilePath: string | null;
}
