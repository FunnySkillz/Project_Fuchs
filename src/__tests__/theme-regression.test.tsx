import React from "react";
import { render, screen } from "@testing-library/react-native";

import HomeRoute from "@/app/(tabs)/home";
import SettingsRoute from "@/app/(tabs)/settings";
import { ThemeModeContext } from "@/contexts/theme-mode-context";
import type { ThemeMode } from "@/theme/theme-mode";

const mockPush = jest.fn();
const mockGetSettings = jest.fn();
const mockUpsertSettings = jest.fn();
const mockListItems = jest.fn();
const mockListMissingReceiptItemIds = jest.fn();
const mockListCategories = jest.fn();
const mockSetThemeMode = jest.fn();
const mockTheme = {
  text: "#1B2330",
  background: "#F7F9FC",
  backgroundElement: "#EEF2F7",
  backgroundSelected: "#DFE6F0",
  textSecondary: "#66758A",
  textMuted: "#7A889C",
  border: "#C8D1DE",
  primary: "#4E7FCF",
  danger: "#C54444",
  success: "#2F8A52",
  textOnPrimary: "#F2F6FC",
};

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => mockTheme,
}));

jest.mock("@gluestack-ui/themed", () => {
  const {
    ActivityIndicator: MockActivityIndicator,
    Pressable: MockPressable,
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
    Actionsheet: ({ isOpen, children }: any) => (isOpen ? <MockView>{children}</MockView> : null),
    ActionsheetBackdrop: Block,
    ActionsheetContent: Block,
    ActionsheetDragIndicator: Block,
    ActionsheetDragIndicatorWrapper: Block,
    ActionsheetItem: ({ children, ...props }: any) => (
      <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>
    ),
    ActionsheetItemText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    AlertDialog: ({ isOpen, children }: any) => (isOpen ? <MockView>{children}</MockView> : null),
    AlertDialogBackdrop: Block,
    AlertDialogBody: Block,
    AlertDialogContent: Block,
    AlertDialogFooter: Block,
    AlertDialogHeader: Block,
    Badge: Block,
    BadgeText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
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
    Pressable: ({ children, ...props }: any) => <MockPressable {...props}>{children}</MockPressable>,
  };
});

jest.mock("expo-router", () => {
  const ReactModule = require("react");
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("@/domain/deductible-impact", () => ({
  computeDeductibleImpactCents: jest.fn(() => 0),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: () => mockGetSettings(),
    upsertSettings: (payload: unknown) => mockUpsertSettings(payload),
  }),
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getItemRepository: async () => ({
    list: (filters?: unknown) => {
      if (
        filters &&
        typeof filters === "object" &&
        ("missingReceipt" in (filters as Record<string, unknown>) ||
          "missingNotes" in (filters as Record<string, unknown>))
      ) {
        return [];
      }
      return mockListItems();
    },
    listMissingReceiptItemIds: () => mockListMissingReceiptItemIds(),
  }),
  getCategoryRepository: async () => ({
    list: () => mockListCategories(),
  }),
}));

jest.mock("@/services/app-events", () => ({
  onProfileSettingsSaved: () => jest.fn(),
  emitDatabaseRestored: jest.fn(),
  emitLocalDataDeleted: jest.fn(),
  emitProfileSettingsSaved: jest.fn(),
}));

jest.mock("@/services/auth/onedrive-auth-provider", () => ({
  getOneDriveAuthProvider: () => ({
    isConnected: async () => false,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock("@/services/onedrive-auth", () => ({
  getOneDriveRedirectUri: () => "app://redirect",
  getSelectedOneDriveFolder: async () => null,
  listOneDriveFolders: jest.fn(async () => []),
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
  hasPinAsync: async () => false,
  isValidPin: jest.fn(() => true),
  setPinAsync: jest.fn(),
  verifyPinAsync: jest.fn(async () => ({ success: true })),
}));

jest.mock("@/services/local-data", () => ({
  deleteAllLocalData: jest.fn(async () => undefined),
}));

function renderWithTheme(ui: React.ReactElement, mode: ThemeMode) {
  const resolvedMode = mode === "system" ? "light" : mode;
  return render(
    <ThemeModeContext.Provider value={{ mode, resolvedMode, setMode: mockSetThemeMode }}>
      {ui}
    </ThemeModeContext.Provider>
  );
}

describe("theme regression smoke", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockGetSettings.mockReset();
    mockUpsertSettings.mockReset();
    mockListItems.mockReset();
    mockListMissingReceiptItemIds.mockReset();
    mockListCategories.mockReset();
    mockSetThemeMode.mockReset();

    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system" as const,
      currency: "EUR" as const,
    });
    mockListItems.mockResolvedValue([]);
    mockListMissingReceiptItemIds.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
  });

  it.each(["light", "dark"] as const)("renders Home in %s mode", async (mode) => {
    renderWithTheme(<HomeRoute />, mode);

    expect(await screen.findByText("Steuerausgleich 2026")).toBeTruthy();
    expect(screen.getByText("No items added yet.")).toBeTruthy();
    expect(screen.getByText("Use the center + button to add your first item.")).toBeTruthy();
    expect(screen.getAllByText("Estimated deductible this year").length).toBeGreaterThan(0);
  });

  it.each(["light", "dark"] as const)("renders Settings in %s mode", async (mode) => {
    renderWithTheme(<SettingsRoute />, mode);

    expect(await screen.findByText("Settings")).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Tax & Calculation")).toBeTruthy();
  });
});
