import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsScreen from "@/app/settings";

const mockSetPreference = jest.fn();
let mockThemePreference: "system" | "light" | "dark" = "system";

const mockGetSettings = jest.fn();
const mockUpsertSettings = jest.fn();
const mockHasPin = jest.fn();
const mockDeleteAllLocalData = jest.fn();
const mockIsConnected = jest.fn();
const mockGetSelectedOneDriveFolder = jest.fn();

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
    AlertDialog: ({ isOpen, children }: any) => (isOpen ? <MockView>{children}</MockView> : null),
    AlertDialogBackdrop: Block,
    AlertDialogBody: Block,
    AlertDialogContent: Block,
    AlertDialogFooter: Block,
    AlertDialogHeader: Block,
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

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("@/contexts/theme-mode-context", () => ({
  useThemeMode: () => ({
    preference: mockThemePreference,
    resolvedColorMode: mockThemePreference === "dark" ? "dark" : "light",
    setPreference: mockSetPreference,
  }),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: () => mockGetSettings(),
    upsertSettings: (payload: unknown) => mockUpsertSettings(payload),
  }),
}));

jest.mock("@/services/auth/onedrive-auth-provider", () => ({
  getOneDriveAuthProvider: () => ({
    isConnected: () => mockIsConnected(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock("@/services/onedrive-auth", () => ({
  getOneDriveRedirectUri: () => "app://redirect",
  getSelectedOneDriveFolder: () => mockGetSelectedOneDriveFolder(),
  listOneDriveFolders: jest.fn(),
  setSelectedOneDriveFolder: jest.fn(),
  ensureSelectedFolderAccessible: jest.fn(),
}));

jest.mock("@/services/backup-restore", () => ({
  createLocalBackupZip: jest.fn(),
  restoreFromBackupZip: jest.fn(),
  shareBackupZip: jest.fn(),
}));

jest.mock("@/services/export-pipeline", () => ({
  runExportPipeline: jest.fn(),
}));

jest.mock("@/services/pin-auth", () => ({
  hasPinAsync: () => mockHasPin(),
  isValidPin: jest.fn(() => true),
  setPinAsync: jest.fn(),
  verifyPinAsync: jest.fn(() => Promise.resolve({ success: true })),
}));

jest.mock("@/services/local-data", () => ({
  deleteAllLocalData: () => mockDeleteAllLocalData(),
}));

jest.mock("@/services/app-events", () => ({
  emitDatabaseRestored: jest.fn(),
  emitLocalDataDeleted: jest.fn(),
  emitProfileSettingsSaved: jest.fn(),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    mockSetPreference.mockReset();
    mockGetSettings.mockReset();
    mockUpsertSettings.mockReset();
    mockHasPin.mockReset();
    mockDeleteAllLocalData.mockReset();
    mockIsConnected.mockReset();
    mockGetSelectedOneDriveFolder.mockReset();
    mockThemePreference = "system";

    const settings = {
      taxYearDefault: 2026,
      marginalRateBps: 4000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      currency: "EUR" as const,
    };

    mockGetSettings.mockResolvedValue(settings);
    mockUpsertSettings.mockResolvedValue(settings);
    mockHasPin.mockResolvedValue(false);
    mockDeleteAllLocalData.mockResolvedValue(undefined);
    mockIsConnected.mockResolvedValue(false);
    mockGetSelectedOneDriveFolder.mockResolvedValue(null);
  });

  it("switches theme and saves tax defaults", async () => {
    render(<SettingsScreen />);

    expect(await screen.findByText("Settings")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-theme-dark"));
    expect(mockSetPreference).toHaveBeenCalledWith("dark");

    fireEvent.press(screen.getByTestId("settings-save"));
    await waitFor(() => {
      expect(mockUpsertSettings).toHaveBeenCalled();
    });
  });

  it("requires confirmation before deleting all local data", async () => {
    render(<SettingsScreen />);

    expect(await screen.findByText("Settings")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-delete-local-data"));
    expect(screen.getByText("Delete all local data?")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-confirm-accept"));
    await waitFor(() => {
      expect(mockDeleteAllLocalData).toHaveBeenCalled();
    });
  });
});
