import {
  friendlyFileErrorMessage,
  isUserCancellationError,
  shouldOfferOpenSettingsForError,
} from "@/services/friendly-errors";

describe("friendly errors", () => {
  it("returns actionable storage message for write failures", () => {
    const message = friendlyFileErrorMessage(
      new Error("ENOSPC: no space left on device while write"),
      "fallback"
    );
    expect(message).toMatch(/local storage/i);
  });

  it("detects user cancellation errors", () => {
    expect(isUserCancellationError(new Error("User canceled picker"))).toBe(true);
    expect(isUserCancellationError(new Error("Operation aborted by user_cancel"))).toBe(true);
    expect(isUserCancellationError(new Error("permission denied"))).toBe(false);
  });

  it("offers open settings for permission-like errors", () => {
    expect(shouldOfferOpenSettingsForError(new Error("Camera permission denied"))).toBe(true);
    expect(shouldOfferOpenSettingsForError(new Error("file access is blocked"))).toBe(true);
    expect(shouldOfferOpenSettingsForError(new Error("disk full"))).toBe(false);
  });
});
