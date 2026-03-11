import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsSecurityRoute from "@/app/(tabs)/settings/security";

const mockGetSettings = jest.fn();
const mockUpsertSettings = jest.fn();
const mockHasPinAsync = jest.fn();
const mockVerifyPinAsync = jest.fn();
const mockSetPinAsync = jest.fn();
const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockAuthenticateAsync = jest.fn();

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

jest.mock("@/services/pin-auth", () => ({
  hasPinAsync: () => mockHasPinAsync(),
  isValidPin: (pin: string) => /^\d{4,6}$/.test(pin),
  setPinAsync: (pin: string) => mockSetPinAsync(pin),
  verifyPinAsync: (pin: string) => mockVerifyPinAsync(pin),
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: () => mockHasHardwareAsync(),
  isEnrolledAsync: () => mockIsEnrolledAsync(),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
}));

describe("SettingsSecurityRoute validation UX", () => {
  beforeEach(() => {
    mockGetSettings.mockReset();
    mockUpsertSettings.mockReset();
    mockHasPinAsync.mockReset();
    mockVerifyPinAsync.mockReset();
    mockSetPinAsync.mockReset();
    mockHasHardwareAsync.mockReset();
    mockIsEnrolledAsync.mockReset();
    mockAuthenticateAsync.mockReset();

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
    mockUpsertSettings.mockResolvedValue(undefined);
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });
  });

  it("shows inline PIN validation errors on submit and enables submit after fixing", async () => {
    mockHasPinAsync.mockResolvedValue(false);
    mockSetPinAsync.mockResolvedValue(undefined);

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-security-new-pin-input"), "12");
    fireEvent.changeText(screen.getByTestId("settings-security-confirm-pin-input"), "12");
    fireEvent.press(screen.getByTestId("settings-security-save-pin"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-security-error-newPin")).toBeTruthy();
      expect(screen.getByTestId("settings-security-save-pin").props.accessibilityState?.disabled).toBe(true);
    });
    expect(mockSetPinAsync).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId("settings-security-new-pin-input"), "1234");
    fireEvent.changeText(screen.getByTestId("settings-security-confirm-pin-input"), "1234");

    await waitFor(() => {
      expect(screen.queryByTestId("settings-security-error-newPin")).toBeNull();
      expect(screen.getByTestId("settings-security-save-pin").props.accessibilityState?.disabled).not.toBe(true);
    });

    fireEvent.press(screen.getByTestId("settings-security-save-pin"));

    await waitFor(() => {
      expect(mockSetPinAsync).toHaveBeenCalledWith("1234");
    });
  });

  it("requires current PIN when changing an existing PIN", async () => {
    mockHasPinAsync.mockResolvedValue(true);
    mockVerifyPinAsync.mockResolvedValue({ success: false });

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-security-new-pin-input"), "1234");
    fireEvent.changeText(screen.getByTestId("settings-security-confirm-pin-input"), "1234");
    fireEvent.press(screen.getByTestId("settings-security-save-pin"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-security-error-currentPin")).toBeTruthy();
      expect(mockVerifyPinAsync).not.toHaveBeenCalled();
    });
  });

  it("authenticates once only when enabling app lock from one user action", async () => {
    let resolveAuth: ((result: { success: boolean }) => void) | null = null;
    mockHasPinAsync.mockResolvedValue(false);
    mockAuthenticateAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAuth = resolve as (result: { success: boolean }) => void;
        })
    );

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    const toggle = screen.getByTestId("settings-security-app-lock-toggle");
    fireEvent(toggle, "valueChange", true);
    fireEvent(toggle, "valueChange", true);

    await waitFor(() => {
      expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1);
    });

    act(() => {
      resolveAuth?.({ success: true });
    });

    await waitFor(() => {
      expect(mockUpsertSettings).toHaveBeenCalledWith(expect.objectContaining({ appLockEnabled: true }));
    });
  });
});
