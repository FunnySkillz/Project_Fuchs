import type { RecordMetadata } from "@/models/record-metadata";

export type AttachmentType = "RECEIPT" | "PHOTO";

export interface Attachment extends RecordMetadata {
  id: string;
  itemId: string;
  type: AttachmentType;
  mimeType: string;
  filePath: string;
  originalFileName: string | null;
  fileSizeBytes: number | null;
}
