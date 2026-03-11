import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsTaxCalculationRoute from "@/app/(tabs)/settings/tax-calculation";

const mockUpsertSettings = jest.fn();
const mockGetSettings = jest.fn();

jest.mock("@gluestack-ui/themed", () => {
  const {
    ActivityIndicator: MockActivityIndicator,
    Switch: MockSwitch,
    Text: MockText,
    TextInput: MockTextInput,
    TouchableOpacity: MockTouchableOpacity,
    View: MockView,
  } = require("react-native");

  const Block = ({ children, testID, ...props }: any) => (
    <MockView testID={testID} {...props}>
      {children}
    </MockView>
  );

  return {
    Box: Block,
    Button: ({ children, ...props }: any) => <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>,
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Card: Block,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    HStack: Block,
    Input: Block,
    InputField: (props: any) => <MockTextInput {...props} />,
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Switch: (props: any) => <MockSwitch {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({
    canGoBack: () => true,
    replace: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    text: "#111827",
    textSecondary: "#6B7280",
    textMuted: "#4B5563",
    background: "#FFFFFF",
    backgroundElement: "#F3F4F6",
    backgroundSelected: "#E5E7EB",
    border: "#D1D5DB",
    primary: "#2563EB",
    danger: "#DC2626",
    success: "#059669",
    textOnPrimary: "#FFFFFF",
  }),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: () => mockGetSettings(),
    upsertSettings: (input: unknown) => mockUpsertSettings(input),
  }),
}));

jest.mock("@/services/app-events", () => ({
  emitProfileSettingsSaved: jest.fn(),
}));

describe("SettingsTaxCalculationRoute", () => {
  beforeEach(() => {
    mockUpsertSettings.mockReset();
    mockGetSettings.mockReset();

    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4_000,
      monthlyGrossIncomeCents: 300_000,
      salaryPaymentsPerYear: 14,
      useManualMarginalTaxRate: false,
      manualMarginalRateBps: 4_000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100_000,
      applyHalfYearRule: false,
      werbungskostenPauschaleEnabled: true,
      werbungskostenPauschaleAmountCents: 13_200,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
    });
  });

  it("computes auto marginal tax rate from monthly gross and salary payments", async () => {
    render(<SettingsTaxCalculationRoute />);

    expect(await screen.findByText("Tax profile")).toBeTruthy();
    expect(screen.getByTestId("settings-auto-marginal-rate")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-monthly-gross-input"), "2000");
    await waitFor(() => {
      expect(screen.getByText("30%")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("settings-salary-payments-12"));
    await waitFor(() => {
      expect(screen.getByText("30%")).toBeTruthy();
    });
  });

  it("shows and hides manual marginal rate input with override toggle", async () => {
    render(<SettingsTaxCalculationRoute />);
    expect(await screen.findByText("Tax profile")).toBeTruthy();

    expect(screen.queryByTestId("settings-marginal-rate-input")).toBeNull();

    fireEvent(screen.getByTestId("settings-manual-rate-toggle"), "valueChange", true);
    expect(await screen.findByTestId("settings-marginal-rate-input")).toBeTruthy();

    fireEvent(screen.getByTestId("settings-manual-rate-toggle"), "valueChange", false);
    await waitFor(() => {
      expect(screen.queryByTestId("settings-marginal-rate-input")).toBeNull();
    });
  });

  it("demotes default work percent to advanced defaults with clear label", async () => {
    render(<SettingsTaxCalculationRoute />);
    expect(await screen.findByText("Advanced defaults")).toBeTruthy();

    expect(screen.queryByText("Default work percent (%)")).toBeNull();
    expect(screen.queryByText("Default work percent for new items only")).toBeNull();

    fireEvent.press(screen.getByTestId("settings-tax-advanced-toggle"));
    expect(await screen.findByText("Default work percent for new items only")).toBeTruthy();
  });

  it("renders disclaimer card", async () => {
    render(<SettingsTaxCalculationRoute />);
    expect(await screen.findByTestId("settings-tax-disclaimer-card")).toBeTruthy();
    expect(screen.getByText("This result is an estimate and not a binding Finanzamt assessment.")).toBeTruthy();
  });

  it("saves effective auto marginal rate when manual override is disabled", async () => {
    render(<SettingsTaxCalculationRoute />);
    expect(await screen.findByText("Tax profile")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-monthly-gross-input"), "3000");
    fireEvent.press(screen.getByTestId("settings-salary-payments-14"));
    fireEvent.press(screen.getByTestId("settings-tax-save"));

    await waitFor(() => {
      expect(mockUpsertSettings).toHaveBeenCalledTimes(1);
      expect(mockUpsertSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          monthlyGrossIncomeCents: 300_000,
          salaryPaymentsPerYear: 14,
          useManualMarginalTaxRate: false,
          marginalRateBps: 4_000,
          werbungskostenPauschaleEnabled: true,
        })
      );
    });
  });
});
