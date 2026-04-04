import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsSecurityRoute from "@/app/(tabs)/settings/security";

const mockGetSettings = jest.fn();
const mockUpsertSettings = jest.fn();
const mockHasPinAsync = jest.fn();
const mockVerifyPinAsync = jest.fn();
const mockSetPinAsync = jest.fn();
const mockClearPinAsync = jest.fn();
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
  clearPinAsync: () => mockClearPinAsync(),
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
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetSettings.mockReset();
    mockUpsertSettings.mockReset();
    mockHasPinAsync.mockReset();
    mockVerifyPinAsync.mockReset();
    mockSetPinAsync.mockReset();
    mockClearPinAsync.mockReset();
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
    mockClearPinAsync.mockResolvedValue(undefined);
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

  it("renders remove button only when a PIN exists", async () => {
    mockHasPinAsync.mockResolvedValue(false);
    const { unmount } = render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();
    expect(screen.queryByTestId("settings-security-remove-pin")).toBeNull();
    unmount();

    mockHasPinAsync.mockResolvedValue(true);
    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();
    expect(screen.getByTestId("settings-security-remove-pin")).toBeTruthy();
  });

  it("requires current PIN before removing PIN", async () => {
    mockHasPinAsync.mockResolvedValue(true);

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-security-remove-pin"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-security-error-currentPin")).toBeTruthy();
      expect(mockVerifyPinAsync).not.toHaveBeenCalled();
      expect(mockClearPinAsync).not.toHaveBeenCalled();
    });
  });

  it("removes PIN and disables app lock after successful current PIN verification", async () => {
    mockHasPinAsync.mockResolvedValue(true);
    mockVerifyPinAsync.mockResolvedValue({
      success: true,
      remainingAttempts: 5,
      lockedUntilEpochMs: null,
    });

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-security-current-pin-input"), "1234");
    fireEvent.press(screen.getByTestId("settings-security-remove-pin"));

    await waitFor(() => {
      expect(mockVerifyPinAsync).toHaveBeenCalledWith("1234");
      expect(mockClearPinAsync).toHaveBeenCalledTimes(1);
      expect(mockUpsertSettings).toHaveBeenCalledWith(expect.objectContaining({ appLockEnabled: false }));
      expect(screen.getByText("PIN removed and app lock disabled.")).toBeTruthy();
    });

    expect(screen.queryByTestId("settings-security-remove-pin")).toBeNull();
    expect(screen.queryByTestId("settings-security-current-pin-input")).toBeNull();
  });

  it("shows current PIN incorrect when removal verification fails without lockout", async () => {
    mockHasPinAsync.mockResolvedValue(true);
    mockVerifyPinAsync.mockResolvedValue({
      success: false,
      remainingAttempts: 3,
      lockedUntilEpochMs: null,
    });

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-security-current-pin-input"), "9999");
    fireEvent.press(screen.getByTestId("settings-security-remove-pin"));

    await waitFor(() => {
      expect(screen.getAllByText("Current PIN is incorrect.").length).toBeGreaterThan(0);
      expect(mockClearPinAsync).not.toHaveBeenCalled();
    });
  });

  it("shows lockout countdown when removal verification is locked", async () => {
    mockHasPinAsync.mockResolvedValue(true);
    mockVerifyPinAsync.mockResolvedValue({
      success: false,
      remainingAttempts: 0,
      lockedUntilEpochMs: Date.now() + 5000,
    });

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-security-current-pin-input"), "1111");
    fireEvent.press(screen.getByTestId("settings-security-remove-pin"));

    await waitFor(() => {
      expect(screen.getAllByText(/Too many failed PIN attempts/).length).toBeGreaterThan(0);
      expect(mockClearPinAsync).not.toHaveBeenCalled();
    });
  });

  it("shows remove error when clear PIN fails", async () => {
    mockHasPinAsync.mockResolvedValue(true);
    mockVerifyPinAsync.mockResolvedValue({
      success: true,
      remainingAttempts: 5,
      lockedUntilEpochMs: null,
    });
    mockClearPinAsync.mockRejectedValue(new Error("secure store down"));

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-security-current-pin-input"), "1234");
    fireEvent.press(screen.getByTestId("settings-security-remove-pin"));

    await waitFor(() => {
      expect(screen.getByText("Could not remove PIN.")).toBeTruthy();
    });
  });

  it("shows remove error when disabling app lock persistence fails", async () => {
    mockHasPinAsync.mockResolvedValue(true);
    mockVerifyPinAsync.mockResolvedValue({
      success: true,
      remainingAttempts: 5,
      lockedUntilEpochMs: null,
    });
    mockUpsertSettings.mockRejectedValue(new Error("db write failed"));

    render(<SettingsSecurityRoute />);
    expect(await screen.findByText("Security")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("settings-security-current-pin-input"), "1234");
    fireEvent.press(screen.getByTestId("settings-security-remove-pin"));

    await waitFor(() => {
      expect(mockClearPinAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Could not remove PIN.")).toBeTruthy();
    });
  });
});
