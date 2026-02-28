import type { RecordMetadata } from "@/models/record-metadata";

export interface Category extends RecordMetadata {
  id: string;
  name: string;
  sortOrder: number;
  isPreset: boolean;
  defaultUsefulLifeMonths: number | null;
}
