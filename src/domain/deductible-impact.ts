import type { Category } from "@/models/category";
import type { Item } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import { estimateTaxImpact } from "@/domain/calculation-engine";

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
  categoryMap: Map<string, Category>,
  taxYear: number = new Date().getFullYear()
): number {
  const result = estimateTaxImpact(
    {
      totalCents: item.totalCents,
      usageType: item.usageType,
      workPercent: item.workPercent,
      purchaseDate: item.purchaseDate,
      usefulLifeMonths: resolveUsefulLifeMonths(item, categoryMap),
    },
    {
      gwgThresholdCents: settings.gwgThresholdCents,
      applyHalfYearRule: settings.applyHalfYearRule,
      marginalRateBps: settings.marginalRateBps,
      defaultWorkPercent: settings.defaultWorkPercent,
    },
    taxYear
  );
  return result.deductibleThisYearCents;
}
