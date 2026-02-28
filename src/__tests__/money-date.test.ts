import { formatCents, parseEuroInputToCents, parseMoneyToCents } from "@/utils/money";
import { addMonthsToYmd, isValidYmd, parseYmd } from "@/utils/date";

describe("money parsing/formatting", () => {
  it("parseMoneyToCents converts 999.99 to 99999", () => {
    expect(parseMoneyToCents("999.99")).toBe(99_999);
  });

  it("parseMoneyToCents handles locale tolerant decimal forms", () => {
    expect(parseMoneyToCents("999,99")).toBe(99_999);
    expect(parseMoneyToCents("1.000,00")).toBe(100_000);
  });

  it("parseMoneyToCents rejects zero and negative values", () => {
    expect(() => parseMoneyToCents("0")).toThrow("greater than 0");
    expect(() => parseMoneyToCents("-5")).toThrow("greater than 0");
  });

  it("parseEuroInputToCents keeps null-safe behavior for forms", () => {
    expect(parseEuroInputToCents("999.99")).toBe(99_999);
    expect(parseEuroInputToCents("0")).toBeNull();
    expect(parseEuroInputToCents("-5")).toBeNull();
    expect(parseEuroInputToCents("abc")).toBeNull();
  });

  it('formatCents(99999, "EUR") returns "999.99 EUR"', () => {
    expect(formatCents(99_999, "EUR")).toBe("999.99 EUR");
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
