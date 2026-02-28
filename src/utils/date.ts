export interface ParsedYmd {
  year: number;
  month: number;
  day: number;
}

export function parseYmd(value: string): ParsedYmd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;

  return valid ? { year, month, day } : null;
}

export function isValidYmd(value: string): boolean {
  return parseYmd(value) !== null;
}

export function formatYmdFromDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatYmdFromDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addMonthsToYmd(value: string, months: number): string | null {
  const parsed = parseYmd(value);
  if (!parsed) {
    return null;
  }

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return formatYmdFromDateUtc(date);
}
