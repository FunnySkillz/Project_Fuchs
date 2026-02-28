import { parseEuroInputToCents, formatCents } from "@/utils/money";
import { addMonthsToYmd, isValidYmd, parseYmd } from "@/utils/date";

describe("money parsing/formatting", () => {
  it("converts 999.99 to 99999 cents", () => {
    expect(parseEuroInputToCents("999.99")).toBe(99_999);
  });

  it("handles localized decimal forms", () => {
    expect(parseEuroInputToCents("1.234,56")).toBe(123_456);
    expect(parseEuroInputToCents("1,234.56")).toBe(123_456);
  });

  it("formats cents consistently", () => {
    expect(formatCents(99_999)).toContain("999");
  });
});

describe("date parsing/formatting safety", () => {
  it("validates ymd dates strictly", () => {
    expect(isValidYmd("2026-02-28")).toBe(true);
    expect(isValidYmd("2026-02-31")).toBe(false);
  });

  it("parses ymd and can add months without timezone drift", () => {
    expect(parseYmd("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(addMonthsToYmd("2026-02-28", 1)).toBe("2026-03-28");
  });
});
