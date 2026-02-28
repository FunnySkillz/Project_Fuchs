import type { Category } from "@/models/category";
import type { Item } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";

function resolveWorkShare(item: Item, defaultWorkPercent: number): number {
  if (item.usageType === "WORK") {
    return 1;
  }
  if (item.usageType === "PRIVATE") {
    return 0;
  }
  if (item.usageType === "MIXED") {
    const percent = item.workPercent ?? defaultWorkPercent;
    return Math.max(0, Math.min(100, percent)) / 100;
  }
  return 0;
}

function resolveUsefulLifeMonths(item: Item, categoryMap: Map<string, Category>): number {
  if (item.usefulLifeMonthsOverride && item.usefulLifeMonthsOverride > 0) {
    return item.usefulLifeMonthsOverride;
  }
  if (item.categoryId) {
    const category = categoryMap.get(item.categoryId);
    if (category?.defaultUsefulLifeMonths && category.defaultUsefulLifeMonths > 0) {
      return category.defaultUsefulLifeMonths;
    }
  }
  return 36;
}

export function computeDeductibleImpactCents(
  item: Item,
  settings: ProfileSettings,
  categoryMap: Map<string, Category>
): number {
  const workShare = resolveWorkShare(item, settings.defaultWorkPercent);
  const workRelevantCents = Math.round(item.totalCents * workShare);
  if (workRelevantCents <= 0) {
    return 0;
  }

  if (workRelevantCents <= settings.gwgThresholdCents) {
    return workRelevantCents;
  }

  const usefulLifeMonths = resolveUsefulLifeMonths(item, categoryMap);
  const monthsDeductedThisYear = settings.applyHalfYearRule ? 6 : 12;
  return Math.round((workRelevantCents / usefulLifeMonths) * monthsDeductedThisYear);
}
