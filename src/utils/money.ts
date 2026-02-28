function normalizeLocalizedAmount(raw: string): string | null {
  const compact = raw.trim().replace(/\s+/g, "").replace(/\u00A0/g, "");
  if (compact.length === 0) {
    return null;
  }

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let decimalSeparator: "," | "." | null = null;
  if (lastComma !== -1 || lastDot !== -1) {
    decimalSeparator = lastComma > lastDot ? "," : ".";
  }

  let normalized = compact;
  if (decimalSeparator === ",") {
    normalized = normalized.replaceAll(".", "");
    const index = normalized.lastIndexOf(",");
    normalized = `${normalized.slice(0, index).replaceAll(",", "")}.${normalized.slice(index + 1)}`;
  } else if (decimalSeparator === ".") {
    normalized = normalized.replaceAll(",", "");
    const index = normalized.lastIndexOf(".");
    normalized = `${normalized.slice(0, index).replaceAll(".", "")}.${normalized.slice(index + 1)}`;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function parseEuroInputToCents(raw: string): number | null {
  const normalized = normalizeLocalizedAmount(raw);
  if (!normalized) {
    return null;
  }

  const [eurosPart, centsPartRaw = ""] = normalized.split(".");
  const centsPart = centsPartRaw.padEnd(2, "0");
  const euros = Number.parseInt(eurosPart, 10);
  const cents = Number.parseInt(centsPart, 10);
  if (!Number.isFinite(euros) || !Number.isFinite(cents)) {
    return null;
  }

  const total = euros * 100 + cents;
  return total > 0 ? total : null;
}

export function formatCents(cents: number, locale: string = "de-AT"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
