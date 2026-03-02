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

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: () => mockGetSettings(),
    upsertSettings: (input: unknown) => mockUpsertSettings(input),
  }),
}));

jest.mock("@/services/app-events", () => ({
  emitProfileSettingsSaved: jest.fn(),
}));

describe("SettingsTaxCalculationRoute validation UX", () => {
  beforeEach(() => {
    mockUpsertSettings.mockReset();
    mockGetSettings.mockReset();

    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
    });
  });

  it("shows inline error on submit attempt and re-enables submit after fixing field", async () => {
    render(<SettingsTaxCalculationRoute />);
    expect(await screen.findByText("Tax & Calculation")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-marginal-rate-input"), "");
    fireEvent.press(screen.getByTestId("settings-tax-save"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-tax-error-marginalRatePercent")).toBeTruthy();
      expect(screen.getByTestId("settings-tax-save").props.accessibilityState?.disabled).toBe(true);
    });
    expect(mockUpsertSettings).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId("settings-marginal-rate-input"), "40");
    await waitFor(() => {
      expect(screen.queryByTestId("settings-tax-error-marginalRatePercent")).toBeNull();
      expect(screen.getByTestId("settings-tax-save").props.accessibilityState?.disabled).not.toBe(true);
    });

    fireEvent.press(screen.getByTestId("settings-tax-save"));

    await waitFor(() => {
      expect(mockUpsertSettings).toHaveBeenCalledTimes(1);
    });
  });
});
