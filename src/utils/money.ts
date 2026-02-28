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

function parseNormalizedToCents(normalized: string): number {
  const [eurosPart, centsPartRaw = ""] = normalized.split(".");
  const centsPart = centsPartRaw.padEnd(2, "0");
  const euros = Number.parseInt(eurosPart, 10);
  const cents = Number.parseInt(centsPart, 10);
  if (!Number.isFinite(euros) || !Number.isFinite(cents)) {
    throw new Error("Invalid money format.");
  }
  return euros * 100 + cents;
}

export function parseMoneyToCents(raw: string): number {
  if (raw.trim().startsWith("-")) {
    throw new Error("Amount must be greater than 0.");
  }

  const normalized = normalizeLocalizedAmount(raw);
  if (!normalized) {
    throw new Error("Invalid money format. Use digits with up to two decimals.");
  }

  const total = parseNormalizedToCents(normalized);
  if (total <= 0) {
    throw new Error("Amount must be greater than 0.");
  }
  return total;
}

export function parseEuroInputToCents(raw: string): number | null {
  try {
    return parseMoneyToCents(raw);
  } catch {
    return null;
  }
}

export function formatCents(cents: number, localeOrCurrency: string = "de-AT"): string {
  if (/^[A-Z]{3}$/.test(localeOrCurrency)) {
    return `${(cents / 100).toFixed(2)} ${localeOrCurrency}`;
  }

  return new Intl.NumberFormat(localeOrCurrency, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
