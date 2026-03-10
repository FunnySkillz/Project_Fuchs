import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";

const mockUseSegments = jest.fn<string[], []>(() => []);
const mockHasValidSettings = jest.fn();
const mockGetSettings = jest.fn();
const mockHasPinAsync = jest.fn();
const mockVerifyPinAsync = jest.fn();
const mockLoadThemePreference = jest.fn();
const mockSaveThemePreference = jest.fn();
const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockAuthenticateAsync = jest.fn();
const mockDeleteAllLocalData = jest.fn();

let localDataDeletedListener: (() => void) | null = null;

jest.mock("../../global.css", () => ({}));

jest.mock("@react-navigation/native", () => ({
  DarkTheme: {},
  DefaultTheme: {},
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("expo-router", () => {
  const ReactModule = require("react");
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Stack: () => <Text testID="root-slot">stack</Text>,
    useSegments: () => mockUseSegments(),
  };
});

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: () => mockHasHardwareAsync(),
  isEnrolledAsync: () => mockIsEnrolledAsync(),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
}));

jest.mock("@/components/gluestack-ui-provider", () => ({
  AppGluestackUIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/animated-icon", () => ({
  AnimatedSplashOverlay: () => null,
}));

jest.mock("@/components/init-error-screen", () => {
  const ReactModule = require("react");
  const { Text } = require("react-native");
  return {
    InitErrorScreen: ({ message }: { message: string }) => <Text>{`init-error:${message}`}</Text>,
  };
});

jest.mock("@/components/app-lock-gate", () => {
  const ReactModule = require("react");
  const { Pressable, Text, TextInput, View } = require("react-native");
  return {
    AppLockGate: ({
      errorMessage,
      pinValue,
      showPinEntry,
      onPinValueChange,
      onPinSubmit,
      onRetry,
      onCancel,
    }: {
      errorMessage: string | null;
      pinValue: string;
      showPinEntry: boolean;
      onPinValueChange: (value: string) => void;
      onPinSubmit: () => void;
      onRetry: () => void;
      onCancel: () => void;
    }) => (
      <View testID="app-lock-gate">
        <Text>{`show-pin:${showPinEntry}`}</Text>
        {errorMessage ? <Text>{errorMessage}</Text> : null}
        <TextInput testID="pin-input" value={pinValue} onChangeText={onPinValueChange} />
        <Pressable testID="pin-submit" onPress={onPinSubmit}>
          <Text>pin-submit</Text>
        </Pressable>
        <Pressable testID="retry-auth" onPress={onRetry}>
          <Text>retry-auth</Text>
        </Pressable>
        <Pressable testID="cancel-auth" onPress={onCancel}>
          <Text>cancel-auth</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    hasValidSettings: () => mockHasValidSettings(),
    getSettings: () => mockGetSettings(),
  }),
}));

jest.mock("@/services/app-events", () => ({
  emitLocalDataDeleted: jest.fn(),
  onDatabaseRestored: () => jest.fn(),
  onProfileSettingsSaved: () => jest.fn(),
  onLocalDataDeleted: (listener: () => void) => {
    localDataDeletedListener = listener;
    return jest.fn();
  },
}));

jest.mock("@/services/pin-auth", () => ({
  hasPinAsync: () => mockHasPinAsync(),
  verifyPinAsync: (...args: unknown[]) => mockVerifyPinAsync(...args),
}));

jest.mock("@/services/theme-preference", () => ({
  loadThemePreference: () => mockLoadThemePreference(),
  saveThemePreference: (...args: unknown[]) => mockSaveThemePreference(...args),
}));

jest.mock("@/theme/theme-mode", () => ({
  resolveThemeMode: (mode: "system" | "light" | "dark", systemMode: "light" | "dark") =>
    mode === "system" ? systemMode : mode,
}));

jest.mock("@/services/debug-report", () => ({
  createInitDebugReport: jest.fn(),
  shareDebugReport: jest.fn(),
}));

jest.mock("@/services/local-data", () => ({
  deleteAllLocalData: () => mockDeleteAllLocalData(),
}));

const RootLayout = require("@/app/_layout").default as React.ComponentType;

describe("RootLayout", () => {
  beforeEach(() => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    jest
      .spyOn(ReactNative.AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as unknown as { remove: () => void });

    localDataDeletedListener = null;
    mockUseSegments.mockReturnValue([]);
    mockHasValidSettings.mockReset();
    mockGetSettings.mockReset();
    mockHasPinAsync.mockReset();
    mockVerifyPinAsync.mockReset();
    mockLoadThemePreference.mockReset();
    mockSaveThemePreference.mockReset();
    mockHasHardwareAsync.mockReset();
    mockIsEnrolledAsync.mockReset();
    mockAuthenticateAsync.mockReset();
    mockDeleteAllLocalData.mockReset();

    mockHasValidSettings.mockResolvedValue(true);
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
    mockHasPinAsync.mockResolvedValue(false);
    mockVerifyPinAsync.mockResolvedValue({ success: true, remainingAttempts: 3 });
    mockLoadThemePreference.mockResolvedValue("system");
    mockSaveThemePreference.mockResolvedValue(undefined);
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });
    mockDeleteAllLocalData.mockResolvedValue(undefined);
  });

  it("routes to onboarding when no valid local profile settings exist", async () => {
    mockHasValidSettings.mockResolvedValue(false);

    render(<RootLayout />);

    expect(await screen.findByText("redirect:/(onboarding)/welcome")).toBeTruthy();
  });

  it("renders app tabs slot when valid settings exist and lock is disabled", async () => {
    render(<RootLayout />);

    expect(await screen.findByTestId("root-slot")).toBeTruthy();
    expect(screen.queryByText("redirect:/(onboarding)/welcome")).toBeNull();
  });

  it("shows PIN lockout countdown when biometric is unavailable and PIN verification fails with lockout", async () => {
    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100000,
      applyHalfYearRule: false,
      appLockEnabled: true,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
    });
    mockHasPinAsync.mockResolvedValue(true);
    mockHasHardwareAsync.mockResolvedValue(false);
    mockIsEnrolledAsync.mockResolvedValue(false);
    mockVerifyPinAsync.mockResolvedValue({
      success: false,
      remainingAttempts: 0,
      lockedUntilEpochMs: Date.now() + 5000,
    });

    render(<RootLayout />);

    expect(await screen.findByTestId("app-lock-gate")).toBeTruthy();
    expect(screen.getByText("show-pin:true")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("pin-input"), "1234");
    fireEvent.press(screen.getByTestId("pin-submit"));

    expect(await screen.findByText(/Too many failed PIN attempts/)).toBeTruthy();
  });

  it("supports cancel then retry authentication flow in app lock gate", async () => {
    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100000,
      applyHalfYearRule: false,
      appLockEnabled: true,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
    });
    mockHasPinAsync.mockResolvedValue(true);
    mockHasHardwareAsync.mockResolvedValue(false);
    mockIsEnrolledAsync.mockResolvedValue(false);

    render(<RootLayout />);
    expect(await screen.findByTestId("app-lock-gate")).toBeTruthy();

    fireEvent.press(screen.getByTestId("cancel-auth"));
    expect(await screen.findByText("Authentication canceled.")).toBeTruthy();

    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });

    fireEvent.press(screen.getByTestId("retry-auth"));

    await waitFor(() => {
      expect(mockAuthenticateAsync).toHaveBeenCalled();
      expect(screen.getByTestId("root-slot")).toBeTruthy();
    });
  });

  it("returns to onboarding route after local-data-deleted lifecycle event", async () => {
    render(<RootLayout />);
    expect(await screen.findByTestId("root-slot")).toBeTruthy();

    await waitFor(() => {
      expect(localDataDeletedListener).not.toBeNull();
    });

    act(() => {
      localDataDeletedListener?.();
    });

    expect(await screen.findByText("redirect:/(onboarding)/welcome")).toBeTruthy();
  });
});
