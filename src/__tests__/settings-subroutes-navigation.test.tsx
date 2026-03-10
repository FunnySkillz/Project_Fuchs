import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsBackupSyncRoute from "@/app/(tabs)/settings/backup-sync";
import SettingsDangerZoneRoute from "@/app/(tabs)/settings/danger-zone";

const mockReplace = jest.fn();
let mockCanGoBack = false;

const mockGetSettings = jest.fn();
const mockIsConnected = jest.fn();
const mockGetSelectedOneDriveFolder = jest.fn();

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
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock("@/services/onedrive-auth", () => ({
  ensureSelectedFolderAccessible: jest.fn(),
  getOneDriveRedirectUri: () => "steuerfuchs://auth",
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
  runExportPipeline: jest.fn(),
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

    mockCanGoBack = false;

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
