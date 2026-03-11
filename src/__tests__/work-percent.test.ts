import { resolveWorkPercent } from "@/domain/work-percent";

describe("resolveWorkPercent", () => {
  it("returns 0 for PRIVATE", () => {
    expect(resolveWorkPercent("PRIVATE", 55)).toBe(0);
  });

  it("returns 100 for WORK", () => {
    expect(resolveWorkPercent("WORK", 12)).toBe(100);
  });

  it("returns stored mixed value when valid", () => {
    expect(resolveWorkPercent("MIXED", 70)).toBe(70);
  });

  it("clamps mixed values above 100", () => {
    expect(resolveWorkPercent("MIXED", 150)).toBe(100);
  });

  it("clamps mixed values below 0", () => {
    expect(resolveWorkPercent("MIXED", -5)).toBe(0);
  });

  it("returns 0 for MIXED when value is null", () => {
    expect(resolveWorkPercent("MIXED", null)).toBe(0);
  });

  it("returns 0 for OTHER", () => {
    expect(resolveWorkPercent("OTHER", 88)).toBe(0);
  });
});
