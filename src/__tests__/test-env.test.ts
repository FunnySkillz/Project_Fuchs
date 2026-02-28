import * as Crypto from "expo-crypto";

describe("test foundation", () => {
  it("freezes Date for deterministic assertions", () => {
    expect(Date.now()).toBe(new Date("2026-01-15T10:30:00.000Z").getTime());
  });

  it("returns deterministic UUID values", () => {
    expect(Crypto.randomUUID()).toBe("00000000-0000-4000-8000-000000000000");
  });
});
