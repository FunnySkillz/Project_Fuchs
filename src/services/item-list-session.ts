import type { ItemUsageType } from "@/models/item";

export type ItemSortMode = "purchase_date_desc" | "price_desc" | "deductible_desc";

export interface ItemListSessionState {
  search: string;
  year: string;
  categoryId: string | null;
  usageType: ItemUsageType | null;
  missingReceipt: boolean;
  missingNotes: boolean;
  sortMode: ItemSortMode;
}

const DEFAULT_ITEM_LIST_SESSION_STATE: ItemListSessionState = {
  search: "",
  year: "",
  categoryId: null,
  usageType: null,
  missingReceipt: false,
  missingNotes: false,
  sortMode: "purchase_date_desc",
};

let sessionState: ItemListSessionState = { ...DEFAULT_ITEM_LIST_SESSION_STATE };

export function getItemListSessionState(): ItemListSessionState {
  return { ...sessionState };
}

export function updateItemListSessionState(
  partial: Partial<ItemListSessionState>
): ItemListSessionState {
  sessionState = {
    ...sessionState,
    ...partial,
  };
  return getItemListSessionState();
}
