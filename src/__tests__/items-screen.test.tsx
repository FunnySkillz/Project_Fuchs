import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ItemsRoute from "@/app/(tabs)/items";
import { formatCents } from "@/utils/money";

const mockPush = jest.fn();
let mockRouteParams: { year?: string; missingReceipt?: string; missingNotes?: string } = {};
const mockListItems = jest.fn();
const mockListMissingReceiptItemIds = jest.fn();
const mockListAttachmentsByItem = jest.fn();
const mockListCategories = jest.fn();
const mockGetSettings = jest.fn();
const mockComputeDeductibleImpactCents = jest.fn();
const mockUpdateItemListSessionState = jest.fn();
const mockDeleteItemWithAttachments = jest.fn();
const mockSwipeableCloseByTestId = new Map<string, jest.Mock>();

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
    AlertDialog: ({ isOpen, children, testID }: any) => (isOpen ? <MockView testID={testID}>{children}</MockView> : null),
    AlertDialogBackdrop: MockContainer,
    AlertDialogBody: MockContainer,
    AlertDialogContent: MockContainer,
    AlertDialogFooter: MockContainer,
    AlertDialogHeader: MockContainer,
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

jest.mock("react-native-gesture-handler", () => {
  const ReactModule = require("react");
  const { TouchableOpacity, View } = require("react-native");

  const Swipeable = ReactModule.forwardRef(
    (
      {
        children,
        onSwipeableWillClose,
        onSwipeableWillOpen,
        onSwipeableOpen,
        renderRightActions,
        testID,
      }: any,
      ref: React.Ref<{ close: () => void }>
    ) => {
      const closeMock = jest.fn(() => {
        onSwipeableWillClose?.();
      });
      mockSwipeableCloseByTestId.set(testID, closeMock);
      const listeners = new Map<string | number, ({ value }: { value: number }) => void>();
      let listenerId = 0;
      const dragX = {
        addListener: (callback: ({ value }: { value: number }) => void) => {
          listenerId += 1;
          listeners.set(listenerId, callback);
          return listenerId;
        },
        removeListener: (id: string | number) => {
          listeners.delete(id);
        },
        interpolate: () => 0,
      };
      const emitDrag = (value: number) => {
        listeners.forEach((listener) => {
          listener({ value });
        });
      };

      ReactModule.useImperativeHandle(ref, () => ({
        close: closeMock,
      }));

      return (
        <View testID={testID}>
          <TouchableOpacity
            testID={`${testID}-open`}
            onPress={() => {
              emitDrag(-40);
              onSwipeableWillOpen?.();
            }}
          />
          <TouchableOpacity
            testID={`${testID}-full-open`}
            onPress={() => {
              emitDrag(-90);
              onSwipeableWillOpen?.();
              onSwipeableOpen?.("right");
            }}
          />
          {typeof renderRightActions === "function" ? renderRightActions({}, dragX) : null}
          {children}
        </View>
      );
    }
  );

  return {
    GestureHandlerRootView: ({ children }: any) => <View>{children}</View>,
    Swipeable,
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
  getAttachmentRepository: async () => ({
    listByItem: mockListAttachmentsByItem,
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

jest.mock("@/services/item-service", () => ({
  deleteItemWithAttachments: (itemId: string) => mockDeleteItemWithAttachments(itemId),
}));

describe("ItemsRoute", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRouteParams = {};
    mockListItems.mockReset();
    mockListMissingReceiptItemIds.mockReset();
    mockListAttachmentsByItem.mockReset();
    mockListCategories.mockReset();
    mockGetSettings.mockReset();
    mockComputeDeductibleImpactCents.mockReset();
    mockUpdateItemListSessionState.mockReset();
    mockDeleteItemWithAttachments.mockReset();
    mockSwipeableCloseByTestId.clear();
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

  it("hydrates missing receipt route param into chip and filtered rows", async () => {
    mockRouteParams = { year: "2026", missingReceipt: "1" };
    const missingReceiptItem = {
      id: "item-1",
      title: "Receipt Missing",
      purchaseDate: "2026-02-01",
      totalCents: 199_900,
      currency: "EUR",
      usageType: "WORK",
      workPercent: null,
      categoryId: null,
      vendor: "Store",
      warrantyMonths: null,
      notes: "Has notes",
      usefulLifeMonthsOverride: null,
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-01T10:00:00.000Z",
      deletedAt: null,
    };
    const notesMissingItem = {
      ...missingReceiptItem,
      id: "item-2",
      title: "Notes Missing",
      notes: null,
      purchaseDate: "2026-02-02",
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
    mockListItems.mockImplementation(async (filters?: { missingReceipt?: boolean }) => {
      if (filters?.missingReceipt) {
        return [missingReceiptItem];
      }
      return [missingReceiptItem, notesMissingItem];
    });
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
    const hasSyncedSessionState = mockUpdateItemListSessionState.mock.calls.some(
      ([state]) => state?.missingReceipt === true && state?.missingNotes === false
    );
    expect(hasSyncedSessionState).toBe(true);
    expect(await screen.findByText("Receipt Missing")).toBeTruthy();
    expect(screen.queryByText("Notes Missing")).toBeNull();
  });

  it("hydrates missing notes route param into chip and filtered rows", async () => {
    mockRouteParams = { year: "2026", missingNotes: "1" };
    const receiptMissingItem = {
      id: "item-1",
      title: "Receipt Missing",
      purchaseDate: "2026-02-01",
      totalCents: 199_900,
      currency: "EUR",
      usageType: "WORK",
      workPercent: null,
      categoryId: null,
      vendor: "Store",
      warrantyMonths: null,
      notes: "Has notes",
      usefulLifeMonthsOverride: null,
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-01T10:00:00.000Z",
      deletedAt: null,
    };
    const notesMissingItem = {
      ...receiptMissingItem,
      id: "item-2",
      title: "Notes Missing",
      notes: null,
      purchaseDate: "2026-02-02",
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
    mockListItems.mockImplementation(async (filters?: { missingNotes?: boolean }) => {
      if (filters?.missingNotes) {
        return [notesMissingItem];
      }
      return [receiptMissingItem, notesMissingItem];
    });
    mockListMissingReceiptItemIds.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    mockComputeDeductibleImpactCents.mockReturnValue(0);

    render(<ItemsRoute />);

    await waitFor(() => {
      const hasFilteredCall = mockListItems.mock.calls.some(([filters]) => {
        return filters?.year === 2026 && filters?.missingNotes === true;
      });
      expect(hasFilteredCall).toBe(true);
    });
    const hasSyncedSessionState = mockUpdateItemListSessionState.mock.calls.some(
      ([state]) => state?.missingNotes === true && state?.missingReceipt === false
    );
    expect(hasSyncedSessionState).toBe(true);
    expect(await screen.findByText("Notes Missing")).toBeTruthy();
    expect(screen.queryByText("Receipt Missing")).toBeNull();
  });

  it("swipes left and deletes an item after attachment confirmation", async () => {
    const item = {
      id: "item-1",
      title: "Work Laptop",
      purchaseDate: "2026-02-01",
      totalCents: 199_900,
      currency: "EUR",
      usageType: "WORK",
      workPercent: null,
      categoryId: null,
      vendor: "Store",
      warrantyMonths: 24,
      notes: "Invoice attached",
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
    let currentItems = [item];
    mockListItems.mockImplementation(async () => [...currentItems]);
    mockListMissingReceiptItemIds.mockImplementation(async () => []);
    mockListCategories.mockResolvedValue([]);
    mockListAttachmentsByItem.mockResolvedValue([{ id: "att-1", itemId: "item-1" }]);
    mockComputeDeductibleImpactCents.mockReturnValue(100_000);
    mockDeleteItemWithAttachments.mockImplementation(async () => {
      currentItems = [];
    });

    render(<ItemsRoute />);

    expect(await screen.findByText("Work Laptop")).toBeTruthy();
    fireEvent.press(screen.getByTestId("items-swipeable-item-1-open"));
    fireEvent.press(screen.getByTestId("items-delete-action-item-1"));

    await waitFor(() => {
      expect(screen.getByTestId("items-delete-confirm-modal")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("items-delete-confirm-delete"));

    await waitFor(() => {
      expect(mockDeleteItemWithAttachments).toHaveBeenCalledWith("item-1");
      expect(screen.queryByText("Work Laptop")).toBeNull();
    });
  });

  it("deletes immediately on full swipe when no attachments exist", async () => {
    const item = {
      id: "item-1",
      title: "Keyboard",
      purchaseDate: "2026-02-01",
      totalCents: 9_990,
      currency: "EUR",
      usageType: "WORK",
      workPercent: null,
      categoryId: null,
      vendor: "Store",
      warrantyMonths: null,
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
    let currentItems = [item];
    mockListItems.mockImplementation(async () => [...currentItems]);
    mockListMissingReceiptItemIds.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    mockListAttachmentsByItem.mockResolvedValue([]);
    mockComputeDeductibleImpactCents.mockReturnValue(2_000);
    mockDeleteItemWithAttachments.mockImplementation(async () => {
      currentItems = [];
    });

    render(<ItemsRoute />);

    expect(await screen.findByText("Keyboard")).toBeTruthy();
    fireEvent.press(screen.getByTestId("items-swipeable-item-1-full-open"));

    await waitFor(() => {
      expect(mockDeleteItemWithAttachments).toHaveBeenCalledWith("item-1");
      expect(screen.queryByText("Keyboard")).toBeNull();
    });
    expect(screen.queryByTestId("items-delete-confirm-modal")).toBeNull();
  });

  it("keeps the item when delete confirmation is canceled", async () => {
    const item = {
      id: "item-1",
      title: "Office Chair",
      purchaseDate: "2026-02-01",
      totalCents: 199_900,
      currency: "EUR",
      usageType: "WORK",
      workPercent: null,
      categoryId: null,
      vendor: "Store",
      warrantyMonths: 24,
      notes: "Invoice attached",
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
    let currentItems = [item];
    mockListItems.mockImplementation(async () => [...currentItems]);
    mockListMissingReceiptItemIds.mockImplementation(async () => []);
    mockListCategories.mockResolvedValue([]);
    mockListAttachmentsByItem.mockResolvedValue([{ id: "att-1", itemId: "item-1" }]);
    mockComputeDeductibleImpactCents.mockReturnValue(100_000);
    mockDeleteItemWithAttachments.mockResolvedValue(undefined);

    render(<ItemsRoute />);

    expect(await screen.findByText("Office Chair")).toBeTruthy();
    fireEvent.press(screen.getByTestId("items-swipeable-item-1-open"));
    fireEvent.press(screen.getByTestId("items-delete-action-item-1"));
    await waitFor(() => {
      expect(screen.getByTestId("items-delete-confirm-modal")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("items-delete-confirm-cancel"));

    expect(screen.queryByTestId("items-delete-confirm-modal")).toBeNull();
    expect(screen.getByText("Office Chair")).toBeTruthy();
    expect(mockDeleteItemWithAttachments).not.toHaveBeenCalled();
  });

  it("keeps only one swipeable row open at a time", async () => {
    const firstItem = {
      id: "item-1",
      title: "First Item",
      purchaseDate: "2026-02-01",
      totalCents: 199_900,
      currency: "EUR",
      usageType: "WORK",
      workPercent: null,
      categoryId: null,
      vendor: "Store",
      warrantyMonths: 24,
      notes: null,
      usefulLifeMonthsOverride: null,
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-01T10:00:00.000Z",
      deletedAt: null,
    };
    const secondItem = {
      ...firstItem,
      id: "item-2",
      title: "Second Item",
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
    mockListItems.mockResolvedValue([firstItem, secondItem]);
    mockListMissingReceiptItemIds.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    mockListAttachmentsByItem.mockResolvedValue([]);
    mockComputeDeductibleImpactCents.mockReturnValue(100_000);

    render(<ItemsRoute />);

    expect(await screen.findByText("First Item")).toBeTruthy();
    fireEvent.press(screen.getByTestId("items-swipeable-item-1-open"));
    fireEvent.press(screen.getByTestId("items-swipeable-item-2-open"));

    const firstRowCloseMock = mockSwipeableCloseByTestId.get("items-swipeable-item-1");
    expect(firstRowCloseMock).toBeDefined();
    expect(firstRowCloseMock).toHaveBeenCalled();
  });
});
