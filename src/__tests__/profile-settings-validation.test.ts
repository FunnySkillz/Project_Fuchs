import { validateProfileSettingsFormInput } from "@/domain/profile-settings-validation";

describe("profile settings validation", () => {
  it("accepts valid values and maps percentages/currency correctly", () => {
    const result = validateProfileSettingsFormInput({
      taxYearDefault: "2026",
      marginalRatePercent: "42.5",
      defaultWorkPercent: "85",
      gwgThresholdEuros: "1000.50",
      applyHalfYearRule: true,
      appLockEnabled: true,
      uploadToOneDriveAfterExport: false,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) {
      throw new Error("Expected validation to be valid");
    }

    expect(result.values).toEqual({
      taxYearDefault: 2026,
      marginalRateBps: 4250,
      defaultWorkPercent: 85,
      gwgThresholdCents: 100050,
      applyHalfYearRule: true,
      appLockEnabled: true,
      uploadToOneDriveAfterExport: false,
    });
  });

  it("returns field errors for invalid inputs", () => {
    const result = validateProfileSettingsFormInput({
      taxYearDefault: "1999",
      marginalRatePercent: "80",
      defaultWorkPercent: "-1",
      gwgThresholdEuros: "-2",
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
    });

    expect(result.valid).toBe(false);
    if (result.valid) {
      throw new Error("Expected validation to fail");
    }

    expect(result.fieldErrors.taxYearDefault).toBe("Tax year must be between 2000 and 2100.");
    expect(result.fieldErrors.marginalRatePercent).toBe(
      "Marginal tax rate must be between 0 and 55%."
    );
    expect(result.fieldErrors.defaultWorkPercent).toBe(
      "Default work percent must be between 0 and 100%."
    );
    expect(result.fieldErrors.gwgThresholdEuros).toBe("GWG threshold must be 0 or higher.");
  });

  it("accepts decimal comma input", () => {
    const result = validateProfileSettingsFormInput({
      taxYearDefault: "2027",
      marginalRatePercent: "37,5",
      defaultWorkPercent: "50",
      gwgThresholdEuros: "952,99",
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: true,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) {
      throw new Error("Expected decimal comma input to be valid");
    }

    expect(result.values.marginalRateBps).toBe(3750);
    expect(result.values.gwgThresholdCents).toBe(95299);
  });
});
