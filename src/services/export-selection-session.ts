import type { ItemUsageType } from "@/models/item";

export interface ExportSelectionSessionState {
  taxYear: string;
  search: string;
  categoryId: string | null;
  usageType: ItemUsageType | null;
  missingReceipt: boolean;
  missingNotes: boolean;
  selectedItemIds: string[];
}

const DEFAULT_EXPORT_SELECTION_SESSION_STATE: ExportSelectionSessionState = {
  taxYear: "",
  search: "",
  categoryId: null,
  usageType: null,
  missingReceipt: false,
  missingNotes: false,
  selectedItemIds: [],
};

let sessionState: ExportSelectionSessionState = {
  ...DEFAULT_EXPORT_SELECTION_SESSION_STATE,
};

export function getExportSelectionSessionState(): ExportSelectionSessionState {
  return {
    ...sessionState,
    selectedItemIds: [...sessionState.selectedItemIds],
  };
}

export function updateExportSelectionSessionState(
  partial: Partial<ExportSelectionSessionState>
): ExportSelectionSessionState {
  sessionState = {
    ...sessionState,
    ...partial,
    selectedItemIds: partial.selectedItemIds
      ? [...partial.selectedItemIds]
      : [...sessionState.selectedItemIds],
  };

  return getExportSelectionSessionState();
}
