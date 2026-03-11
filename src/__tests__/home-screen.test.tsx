import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import HomeRoute from "@/app/(tabs)/home";
import { formatCents } from "@/utils/money";

const mockPush = jest.fn();
const mockGetSettings = jest.fn();
const mockItemList = jest.fn();
const mockCategoryList = jest.fn();
const mockComputeDeductible = jest.fn();
const mockOnProfileSettingsSaved = jest.fn((_: () => void) => jest.fn());
const mockTheme = {
  text: "#1B2330",
  background: "#F7F9FC",
  backgroundElement: "#EEF2F7",
  backgroundSelected: "#DFE6F0",
  textSecondary: "#66758A",
  textMuted: "#7A889C",
  border: "#C8D1DE",
  primary: "#4E7FCF",
  warning: "#D8891A",
  warningText: "#A65F06",
  warningBackground: "#2D2215",
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
    Text: MockText,
    TouchableOpacity: MockTouchableOpacity,
    View: MockView,
  } = require("react-native");

  return {
    Box: ({ children, ...props }: any) => <MockView {...props}>{children}</MockView>,
    VStack: ({ children, ...props }: any) => <MockView {...props}>{children}</MockView>,
    HStack: ({ children, ...props }: any) => <MockView {...props}>{children}</MockView>,
    Card: ({ children, ...props }: any) => <MockView {...props}>{children}</MockView>,
    Pressable: ({ children, ...props }: any) => (
      <MockPressable {...props}>{children}</MockPressable>
    ),
    Button: ({ children, ...props }: any) => (
      <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>
    ),
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Badge: ({ children, ...props }: any) => <MockView {...props}>{children}</MockView>,
    BadgeText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    GluestackUIProvider: ({ children }: any) => <>{children}</>,
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

jest.mock("@/domain/deductible-impact", () => ({
  computeDeductibleImpactCents: (
    item: unknown,
    settings: unknown,
    categoryMap: unknown,
    year: unknown
  ) => mockComputeDeductible(item, settings, categoryMap, year),
}));

jest.mock("@/services/app-events", () => ({
  onProfileSettingsSaved: (handler: () => void) => mockOnProfileSettingsSaved(handler),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: mockGetSettings,
  }),
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getItemRepository: async () => ({
    list: mockItemList,
  }),
  getCategoryRepository: async () => ({
    list: mockCategoryList,
  }),
}));

function renderHome() {
  return render(
    <SafeAreaProvider>
      <HomeRoute />
    </SafeAreaProvider>
  );
}

describe("HomeRoute", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockGetSettings.mockReset();
    mockItemList.mockReset();
    mockCategoryList.mockReset();
    mockComputeDeductible.mockReset();
    mockOnProfileSettingsSaved.mockReset();
    mockOnProfileSettingsSaved.mockReturnValue(jest.fn());
  });

  it("renders dashboard summary and compact attention cards with filter navigation", async () => {
    const yearItems = [
      {
        id: "item-a",
        title: "Laptop",
      },
      {
        id: "item-b",
        title: "Phone",
      },
    ];

    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4_000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100_000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
    });
    mockItemList.mockImplementation(async (filters?: { missingReceipt?: boolean; missingNotes?: boolean }) => {
      if (filters?.missingReceipt) {
        return [yearItems[0]];
      }
      if (filters?.missingNotes) {
        return [yearItems[1]];
      }
      return yearItems;
    });
    mockCategoryList.mockResolvedValue([]);
    mockComputeDeductible.mockImplementation((item: { id: string }) => (item.id === "item-a" ? 10_000 : 20_000));

    renderHome();

    expect(await screen.findByText("Steuerausgleich 2026")).toBeTruthy();
    expect(screen.getAllByText("Estimated deductible this year").length).toBeGreaterThan(0);
    expect(screen.getByText(formatCents(30_000))).toBeTruthy();
    expect(screen.getByText(`Estimated tax refund impact: ${formatCents(12_000)}`)).toBeTruthy();
    expect(screen.getByText("Attention needed")).toBeTruthy();
    expect(screen.getByTestId("home-missing-receipts-card")).toBeTruthy();
    expect(screen.getByTestId("home-missing-notes-card")).toBeTruthy();
    expect(screen.getByText("Review items")).toBeTruthy();
    expect(screen.getByText("Add missing notes")).toBeTruthy();

    fireEvent.press(screen.getByTestId("home-missing-receipts-row"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/items",
      params: { year: "2026", missingReceipt: "1" },
    });

    fireEvent.press(screen.getByTestId("home-missing-notes-row"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/items",
      params: { year: "2026", missingNotes: "1" },
    });
  });

  it("shows an empty state when no items exist for the active year", async () => {
    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4_000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100_000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
    });
    mockItemList.mockResolvedValue([]);
    mockCategoryList.mockResolvedValue([]);
    mockComputeDeductible.mockReturnValue(0);

    renderHome();

    expect(await screen.findByText("No items added yet.")).toBeTruthy();
    expect(screen.getByText("Use the center + button to add your first item.")).toBeTruthy();
    expect(screen.queryByText("Attention needed")).toBeNull();
    expect(screen.queryByTestId("home-missing-receipts-row")).toBeNull();
    expect(screen.queryByTestId("home-missing-notes-row")).toBeNull();
    expect(screen.queryByText("Everything looks good.")).toBeNull();
    expect(screen.queryByText("Go to Items")).toBeNull();
    expect(screen.queryByText("Add Item")).toBeNull();
  });

  it("shows Everything looks good when items exist without attention issues", async () => {
    const yearItems = [
      {
        id: "item-a",
        title: "Laptop",
      },
      {
        id: "item-b",
        title: "Phone",
      },
    ];

    mockGetSettings.mockResolvedValue({
      taxYearDefault: 2026,
      marginalRateBps: 4_000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100_000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
    });
    mockItemList.mockImplementation(async (filters?: { missingReceipt?: boolean; missingNotes?: boolean }) => {
      if (filters?.missingReceipt || filters?.missingNotes) {
        return [];
      }
      return yearItems;
    });
    mockCategoryList.mockResolvedValue([]);
    mockComputeDeductible.mockImplementation(() => 20_000);

    renderHome();

    expect(await screen.findByText("Attention needed")).toBeTruthy();
    expect(screen.getByText("Everything looks good.")).toBeTruthy();
    expect(screen.queryByTestId("home-missing-receipts-row")).toBeNull();
    expect(screen.queryByTestId("home-missing-notes-row")).toBeNull();
  });

  it("shows error state and retries loading", async () => {
    mockGetSettings.mockRejectedValue(new Error("DB offline"));

    renderHome();

    expect(await screen.findByText("Could not load dashboard")).toBeTruthy();

    fireEvent.press(screen.getByText("Retry"));

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(2);
    });
  });
});
