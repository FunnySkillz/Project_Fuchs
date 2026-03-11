import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsBackupSyncRoute from "@/app/(tabs)/settings/backup-sync";
import SettingsDangerZoneRoute from "@/app/(tabs)/settings/danger-zone";

const mockReplace = jest.fn();
let mockCanGoBack = false;

const mockGetSettings = jest.fn();
const mockIsConnected = jest.fn();
const mockGetSelectedOneDriveFolder = jest.fn();
const mockConnectOneDrive = jest.fn();
const mockDisconnectOneDrive = jest.fn();
const mockRunExportPipeline = jest.fn();
let mockOneDriveConfigured = true;

jest.mock("@gluestack-ui/themed", () => {
  const {
    ActivityIndicator: MockActivityIndicator,
    Switch: MockSwitch,
    Text: MockText,
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
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Switch: (props: any) => <MockSwitch {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({
    canGoBack: () => mockCanGoBack,
    replace: mockReplace,
  }),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("@/contexts/theme-mode-context", () => ({
  useThemeMode: () => ({
    mode: "system",
    resolvedMode: "light",
    setMode: jest.fn(),
  }),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: () => mockGetSettings(),
    upsertSettings: jest.fn(),
  }),
}));

jest.mock("@/services/app-events", () => ({
  emitDatabaseRestored: jest.fn(),
  emitLocalDataDeleted: jest.fn(),
  emitProfileSettingsSaved: jest.fn(),
}));

jest.mock("@/services/local-data", () => ({
  deleteAllLocalData: jest.fn(),
}));

jest.mock("@/services/auth/onedrive-auth-provider", () => ({
  getOneDriveAuthProvider: () => ({
    isConnected: () => mockIsConnected(),
    connect: () => mockConnectOneDrive(),
    disconnect: () => mockDisconnectOneDrive(),
  }),
}));

jest.mock("@/services/onedrive-auth", () => ({
  ensureSelectedFolderAccessible: jest.fn(),
  getOneDriveRedirectUri: () => "steuerfuchs://auth",
  isOneDriveConfigured: () => mockOneDriveConfigured,
  getSelectedOneDriveFolder: () => mockGetSelectedOneDriveFolder(),
  listOneDriveFolders: jest.fn(),
  setSelectedOneDriveFolder: jest.fn(),
}));

jest.mock("@/services/backup-restore", () => ({
  createLocalBackupZip: jest.fn(),
  restoreFromBackupZip: jest.fn(),
  shareBackupZip: jest.fn(),
}));

jest.mock("@/services/export-pipeline", () => ({
  runExportPipeline: (...args: unknown[]) => mockRunExportPipeline(...args),
}));

jest.mock("@/services/friendly-errors", () => ({
  friendlyFileErrorMessage: () => "Something went wrong",
}));

describe("Settings subroutes fallback navigation", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockGetSettings.mockReset();
    mockIsConnected.mockReset();
    mockGetSelectedOneDriveFolder.mockReset();
    mockConnectOneDrive.mockReset();
    mockDisconnectOneDrive.mockReset();
    mockRunExportPipeline.mockReset();

    mockCanGoBack = false;
    mockOneDriveConfigured = true;

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
    mockIsConnected.mockResolvedValue(false);
    mockGetSelectedOneDriveFolder.mockResolvedValue(null);
    mockConnectOneDrive.mockResolvedValue(undefined);
    mockDisconnectOneDrive.mockResolvedValue(undefined);
    mockRunExportPipeline.mockResolvedValue({
      localFileUri: "file:///exports/test.txt",
      localFileName: "test.txt",
      uploadStatus: "skipped",
      uploadedFileName: null,
      uploadError: null,
    });
  });

  it("shows fallback back button on Backup & Sync when route has no history", async () => {
    render(<SettingsBackupSyncRoute />);

    expect(await screen.findByText("Backup & Sync")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-back-to-main-fallback"));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
  });

  it("hides fallback back button on Backup & Sync when history exists", async () => {
    mockCanGoBack = true;
    render(<SettingsBackupSyncRoute />);

    expect(await screen.findByText("Backup & Sync")).toBeTruthy();
    expect(screen.queryByTestId("settings-back-to-main-fallback")).toBeNull();
  });

  it("hides OneDrive connect action and shows friendly config copy when build is not configured", async () => {
    mockOneDriveConfigured = false;
    render(<SettingsBackupSyncRoute />);

    expect(await screen.findByText("Backup & Sync")).toBeTruthy();
    expect(screen.getByTestId("settings-onedrive-config-missing")).toBeTruthy();
    expect(screen.getByTestId("settings-onedrive-config-hint")).toBeTruthy();
    expect(screen.queryByTestId("settings-onedrive-connect")).toBeNull();
  });

  it("shows OneDrive connect action when build is configured", async () => {
    mockOneDriveConfigured = true;
    render(<SettingsBackupSyncRoute />);

    expect(await screen.findByText("Backup & Sync")).toBeTruthy();
    expect(screen.getByTestId("settings-onedrive-connect")).toBeTruthy();
  });

  it("shows generic user error when OneDrive connect fails", async () => {
    mockOneDriveConfigured = true;
    mockConnectOneDrive.mockRejectedValueOnce(new Error("OneDrive OAuth is not configured."));

    render(<SettingsBackupSyncRoute />);
    expect(await screen.findByText("Backup & Sync")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-onedrive-connect"));

    await waitFor(() => {
      expect(
        screen.getByText("Unable to connect to OneDrive. Please try again.")
      ).toBeTruthy();
    });
  });

  it("shows connected status when OneDrive is already connected", async () => {
    mockOneDriveConfigured = true;
    mockIsConnected.mockResolvedValue(true);
    mockGetSelectedOneDriveFolder.mockResolvedValue({
      id: "folder-1",
      path: "/Documents/SteuerFuchs",
    });

    render(<SettingsBackupSyncRoute />);

    expect(await screen.findByText("Backup & Sync")).toBeTruthy();
    expect(screen.getByText("Status: Connected")).toBeTruthy();
    expect(screen.getByText("Selected folder: /Documents/SteuerFuchs")).toBeTruthy();
    expect(screen.queryByTestId("settings-onedrive-connect")).toBeNull();
  });

  it("keeps local export successful when OneDrive upload fails", async () => {
    mockOneDriveConfigured = true;
    mockIsConnected.mockResolvedValue(true);
    mockGetSelectedOneDriveFolder.mockResolvedValue({
      id: "folder-1",
      path: "/Documents/SteuerFuchs",
    });
    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: true,
      themeModePreference: "system",
      currency: "EUR",
    });
    mockRunExportPipeline.mockResolvedValue({
      localFileUri: "file:///exports/export-failed-upload.txt",
      localFileName: "export-failed-upload.txt",
      uploadStatus: "failed",
      uploadedFileName: null,
      uploadError: "OneDrive upload failed, but your local export was created successfully.",
    });

    render(<SettingsBackupSyncRoute />);
    expect(await screen.findByText("Backup & Sync")).toBeTruthy();

    fireEvent.press(screen.getByText("Run test export pipeline"));

    await waitFor(() => {
      expect(mockRunExportPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadToOneDrive: true,
        })
      );
      expect(screen.getByText("OneDrive upload failed, but your local export was created successfully.")).toBeTruthy();
      expect(screen.getByText("Local file: export-failed-upload.txt | Upload failed (local export still saved)")).toBeTruthy();
    });
  });

  it("shows fallback back button on Danger Zone when route has no history", async () => {
    render(<SettingsDangerZoneRoute />);

    expect(await screen.findByText("Danger Zone")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-back-to-main-fallback"));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
  });

  it("hides fallback back button on Danger Zone when history exists", async () => {
    mockCanGoBack = true;
    render(<SettingsDangerZoneRoute />);

    expect(await screen.findByText("Danger Zone")).toBeTruthy();
    expect(screen.queryByTestId("settings-back-to-main-fallback")).toBeNull();
  });
});
