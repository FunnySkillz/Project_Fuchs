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
const mockGetDocumentAsync = jest.fn();
const mockCreateLocalBackupZip = jest.fn();
const mockRestoreFromBackupZip = jest.fn();
const mockShareBackupZip = jest.fn();
const mockEmitDatabaseRestored = jest.fn();
const mockEmitLocalDataDeleted = jest.fn();
const mockEmitProfileSettingsSaved = jest.fn();

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
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock("@/contexts/theme-mode-context", () => ({
  useThemeMode: () => ({
    mode: mockThemePreference,
    resolvedMode: mockThemePreference === "dark" ? "dark" : "light",
    setMode: mockSetPreference,
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
  createLocalBackupZip: (...args: unknown[]) => mockCreateLocalBackupZip(...args),
  restoreFromBackupZip: (...args: unknown[]) => mockRestoreFromBackupZip(...args),
  shareBackupZip: (...args: unknown[]) => mockShareBackupZip(...args),
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
  emitDatabaseRestored: (...args: unknown[]) => mockEmitDatabaseRestored(...args),
  emitLocalDataDeleted: (...args: unknown[]) => mockEmitLocalDataDeleted(...args),
  emitProfileSettingsSaved: (...args: unknown[]) => mockEmitProfileSettingsSaved(...args),
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
    mockGetDocumentAsync.mockReset();
    mockCreateLocalBackupZip.mockReset();
    mockRestoreFromBackupZip.mockReset();
    mockShareBackupZip.mockReset();
    mockEmitDatabaseRestored.mockReset();
    mockEmitLocalDataDeleted.mockReset();
    mockEmitProfileSettingsSaved.mockReset();
    mockThemePreference = "system";

    const settings = {
      taxYearDefault: 2030,
      marginalRateBps: 3500,
      defaultWorkPercent: 64,
      gwgThresholdCents: 85000,
      applyHalfYearRule: true,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: true,
      themeModePreference: "system" as const,
      currency: "EUR" as const,
    };

    mockGetSettings.mockResolvedValue(settings);
    mockUpsertSettings.mockResolvedValue(settings);
    mockHasPin.mockResolvedValue(false);
    mockDeleteAllLocalData.mockResolvedValue(undefined);
    mockIsConnected.mockResolvedValue(false);
    mockGetSelectedOneDriveFolder.mockResolvedValue(null);
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
    mockCreateLocalBackupZip.mockResolvedValue({
      fileUri: "file:///exports/backup.zip",
      fileName: "backup.zip",
      sizeBytes: 1024,
      manifest: { attachmentCount: 0, missingAttachmentCount: 0 },
    });
    mockRestoreFromBackupZip.mockResolvedValue({
      itemCountRestored: 0,
      attachmentCountRestored: 0,
      missingFilesCount: 0,
    });
    mockShareBackupZip.mockResolvedValue(undefined);
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
    expect(screen.getByTestId("settings-default-work-percent-input").props.value).toBe("64");

    fireEvent.press(screen.getByTestId("settings-delete-local-data"));
    expect(screen.getByText("Delete all local data?")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-confirm-accept"));
    await waitFor(() => {
      expect(mockDeleteAllLocalData).toHaveBeenCalled();
      expect(mockEmitLocalDataDeleted).toHaveBeenCalled();
      expect(mockSetPreference).toHaveBeenCalledWith("system");
      expect(screen.getByTestId("settings-default-work-percent-input").props.value).toBe("100");
    });
  });

  it("keeps local data unchanged when backup import picker is canceled", async () => {
    mockGetDocumentAsync.mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });

    render(<SettingsScreen />);
    expect(await screen.findByText("Settings")).toBeTruthy();

    fireEvent.press(screen.getByText("Import backup (overwrite)"));
    expect(screen.getByText("Import backup snapshot?")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-confirm-accept"));

    await waitFor(() => {
      expect(mockGetDocumentAsync).toHaveBeenCalled();
      expect(mockRestoreFromBackupZip).not.toHaveBeenCalled();
      expect(mockEmitDatabaseRestored).not.toHaveBeenCalled();
      expect(screen.queryByText("Import backup snapshot?")).toBeNull();
    });
  });
});
