import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ItemsRoute from "@/app/(tabs)/items";
import { formatCents } from "@/utils/money";

const mockPush = jest.fn();
let mockRouteParams: { year?: string; missingReceipt?: string; missingNotes?: string } = {};
const mockListItems = jest.fn();
const mockListMissingReceiptItemIds = jest.fn();
const mockListCategories = jest.fn();
const mockGetSettings = jest.fn();
const mockComputeDeductibleImpactCents = jest.fn();
const mockUpdateItemListSessionState = jest.fn();

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    text: "#1B2330",
    background: "#F7F9FC",
    backgroundElement: "#EEF2F7",
    backgroundSelected: "#DFE6F0",
    textSecondary: "#66758A",
    border: "#C8D1DE",
    primary: "#4E7FCF",
    danger: "#C54444",
    textOnPrimary: "#F2F6FC",
  }),
}));

jest.mock("@gluestack-ui/themed", () => {
  const ReactModule = require("react");
  const {
    ActivityIndicator: MockActivityIndicator,
    Pressable: MockPressable,
    Text: MockText,
    TextInput: MockTextInput,
    TouchableOpacity: MockTouchableOpacity,
    View: MockView,
  } = require("react-native");

  const MockContainer = ({ children, testID }: any) => <MockView testID={testID}>{children}</MockView>;

  return {
    Box: MockContainer,
    VStack: MockContainer,
    HStack: MockContainer,
    Card: MockContainer,
    Pressable: ({ children, ...props }: any) => <MockPressable {...props}>{children}</MockPressable>,
    Button: ({ children, ...props }: any) => <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>,
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Badge: MockContainer,
    BadgeText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Input: MockContainer,
    InputField: (props: any) => <MockTextInput {...props} />,
    Actionsheet: ({ isOpen, children }: any) => (isOpen ? <MockView>{children}</MockView> : null),
    ActionsheetBackdrop: MockContainer,
    ActionsheetContent: MockContainer,
    ActionsheetDragIndicator: MockContainer,
    ActionsheetDragIndicatorWrapper: MockContainer,
    ActionsheetItem: ({ children, ...props }: any) => (
      <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>
    ),
    ActionsheetItemText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
  };
});

jest.mock("expo-router", () => {
  const ReactModule = require("react");
  return {
    useRouter: () => ({ push: mockPush }),
    useLocalSearchParams: () => mockRouteParams,
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
  ) => mockComputeDeductibleImpactCents(item, settings, categoryMap, year),
}));

jest.mock("@/services/item-list-session", () => ({
  getItemListSessionState: () => ({
    search: "",
    year: "",
    categoryId: null,
    usageType: null,
    missingReceipt: false,
    missingNotes: false,
    sortMode: "purchase_date_desc",
  }),
  updateItemListSessionState: (partial: unknown) => mockUpdateItemListSessionState(partial),
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getItemRepository: async () => ({
    list: mockListItems,
    listMissingReceiptItemIds: mockListMissingReceiptItemIds,
  }),
  getCategoryRepository: async () => ({
    list: mockListCategories,
  }),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: mockGetSettings,
  }),
}));

describe("ItemsRoute", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRouteParams = {};
    mockListItems.mockReset();
    mockListMissingReceiptItemIds.mockReset();
    mockListCategories.mockReset();
    mockGetSettings.mockReset();
    mockComputeDeductibleImpactCents.mockReset();
    mockUpdateItemListSessionState.mockReset();
  });

  it("renders item rows with required fields and opens item detail on row tap", async () => {
    const item = {
      id: "item-1",
      title: "Work Laptop",
      purchaseDate: "2026-02-01",
      totalCents: 199_900,
      currency: "EUR",
      usageType: "WORK",
      workPercent: null,
      categoryId: "cat-laptop",
      vendor: "Store",
      warrantyMonths: 24,
      notes: null,
      usefulLifeMonthsOverride: null,
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-01T10:00:00.000Z",
      deletedAt: null,
    };

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
    mockListItems.mockResolvedValue([item]);
    mockListMissingReceiptItemIds.mockResolvedValue(["item-1"]);
    mockListCategories.mockResolvedValue([
      {
        id: "cat-laptop",
        name: "Laptop/Computer",
        sortOrder: 10,
        isPreset: true,
        defaultUsefulLifeMonths: 36,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
      },
    ]);
    mockComputeDeductibleImpactCents.mockReturnValue(90_000);

    render(<ItemsRoute />);

    expect(await screen.findByText("Work Laptop")).toBeTruthy();
    expect(screen.getByText("Laptop/Computer • 2026-02-01")).toBeTruthy();
    expect(screen.getByText(formatCents(199_900))).toBeTruthy();
    expect(screen.getByText(`Deductible this year: ${formatCents(90_000)}`)).toBeTruthy();
    expect(screen.getAllByText("Missing receipt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing notes").length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId("items-row-item-1"));
    expect(mockPush).toHaveBeenCalledWith("/item/item-1");
  });

  it("shows contract empty state copy when there are no matching items", async () => {
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
    mockListItems.mockResolvedValue([]);
    mockListMissingReceiptItemIds.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    mockComputeDeductibleImpactCents.mockReturnValue(0);

    render(<ItemsRoute />);

    expect(await screen.findByText("No items found. Adjust filters or add a new item.")).toBeTruthy();
  });

  it("does not render a floating add-item FAB anymore", async () => {
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
    mockListItems.mockResolvedValue([]);
    mockListMissingReceiptItemIds.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    mockComputeDeductibleImpactCents.mockReturnValue(0);

    render(<ItemsRoute />);

    expect(await screen.findByText("No items found. Adjust filters or add a new item.")).toBeTruthy();
    expect(screen.queryByTestId("items-add-fab")).toBeNull();
  });

  it("applies incoming year and missing receipt params from navigation", async () => {
    mockRouteParams = { year: "2026", missingReceipt: "1" };
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
    mockListItems.mockResolvedValue([]);
    mockListMissingReceiptItemIds.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    mockComputeDeductibleImpactCents.mockReturnValue(0);

    render(<ItemsRoute />);

    await waitFor(() => {
      const hasFilteredCall = mockListItems.mock.calls.some(([filters]) => {
        return filters?.year === 2026 && filters?.missingReceipt === true;
      });
      expect(hasFilteredCall).toBe(true);
    });
  });
});
