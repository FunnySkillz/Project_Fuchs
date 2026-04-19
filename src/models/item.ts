import type { RecordMetadata } from "@/models/record-metadata";

export type ItemUsageType = "WORK" | "PRIVATE" | "MIXED" | "OTHER";
export type ItemPurchaseKind = "ONE_TIME" | "SUBSCRIPTION";
export type SubscriptionBillingCadence = "MONTHLY" | "YEARLY";

export interface Item extends RecordMetadata {
  id: string;
  title: string;
  purchaseDate: string;
  totalCents: number;
  currency: "EUR";
  usageType: ItemUsageType;
  workPercent: number | null;
  categoryId: string | null;
  vendor: string | null;
  warrantyMonths: number | null;
  notes: string | null;
  usefulLifeMonthsOverride: number | null;
  purchaseKind: ItemPurchaseKind;
  billingCadence: SubscriptionBillingCadence | null;
  subscriptionEndDate: string | null;
}
