import type { ItemUsageType } from "@/models/item";

function clampToPercentRange(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export function resolveWorkPercent(
  usageType: ItemUsageType,
  workPercent?: number | null
): number {
  if (usageType === "WORK") {
    return 100;
  }

  if (usageType === "PRIVATE" || usageType === "OTHER") {
    return 0;
  }

  if (workPercent === null || workPercent === undefined) {
    return 0;
  }

  return clampToPercentRange(workPercent);
}
