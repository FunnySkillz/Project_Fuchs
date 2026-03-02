import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import HomeRoute from "@/app/(tabs)/home";
import ItemsRoute from "@/app/(tabs)/items";
import OnboardingProfileSetupRoute from "@/app/(onboarding)/profile-setup";
import OnboardingWelcomeRoute from "@/app/(onboarding)/welcome";
import ItemDetailRoute from "@/app/item/[id]";
import NewItemRoute from "@/app/item/new";
import type { Item, ItemUsageType } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import type { StoredAttachmentFile } from "@/services/attachment-storage";

jest.mock("@/constants/theme", () => ({
  Colors: {
    light: {
      text: "#1B2330",
      background: "#F7F9FC",
      backgroundElement: "#EEF2F7",
      backgroundSelected: "#DFE6F0",
      textSecondary: "#66758A",
      border: "#C8D1DE",
      primary: "#4E7FCF",
      danger: "#C54444",
      textOnPrimary: "#F2F6FC",
    },
    dark: {
      text: "#E9EEF6",
      background: "#131922",
      backgroundElement: "#1C2430",
      backgroundSelected: "#2A3544",
      textSecondary: "#A6B2C3",
      border: "#38475D",
      primary: "#6E97DF",
      danger: "#E66B6B",
      textOnPrimary: "#F1F5FB",
    },
  },
  Spacing: {
    one: 4,
    two: 8,
    three: 16,
    four: 24,
  },
}));

let mockLocalSearchParams: Record<string, string | string[] | undefined> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDeleteItemWithAttachments = jest.fn();

function mockApplyRouteTarget(target: unknown) {
  if (
    typeof target === "object" &&
    target !== null &&
    "pathname" in target &&
    (target as { pathname?: unknown }).pathname === "/item/new"
  ) {
    const params =
      "params" in target && typeof (target as { params?: unknown }).params === "object"
        ? ((target as { params?: Record<string, string | string[] | undefined> }).params ?? {})
        : {};
    mockLocalSearchParams = {
      draftId: params.draftId,
    };
  }
}

const mockRouter = {
  push: (target: unknown) => {
    mockPush(target);
    mockApplyRouteTarget(target);
  },
  replace: (target: unknown) => {
    mockReplace(target);
    mockApplyRouteTarget(target);
  },
};

jest.mock("expo-router", () => {
  const ReactModule = require("react");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockLocalSearchParams,
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock("@/components/themed-text", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
  };
});

jest.mock("@/components/themed-view", () => {
  const { View } = require("react-native");
  return {
    ThemedView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock("@/components/ui", () => {
  const { Text: MockText, TextInput: MockTextInput, TouchableOpacity, View } = require("react-native");
  return {
    Button: ({ label, onPress, disabled }: any) => (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        <MockText>{label}</MockText>
      </TouchableOpacity>
    ),
    Card: ({ children }: any) => <View>{children}</View>,
    FormField: ({ label, children }: any) => (
      <View>
        <MockText>{label}</MockText>
        {children}
      </View>
    ),
    Input: (props: any) => <MockTextInput {...props} />,
  };
});

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
    Modal: ({ isOpen, children }: any) => (isOpen ? <MockView>{children}</MockView> : null),
    ModalBackdrop: Block,
    ModalBody: Block,
    ModalContent: Block,
    Pressable: ({ children, ...props }: any) => <MockPressable {...props}>{children}</MockPressable>,
    Slider: Block,
    SliderFilledTrack: Block,
    SliderThumb: Block,
    SliderTrack: Block,
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Switch: (props: any) => <MockSwitch {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Textarea: Block,
    TextareaInput: (props: any) => <MockTextInput {...props} />,
    VStack: Block,
  };
});

jest.mock("expo-image", () => {
  const { View: MockView } = require("react-native");
  return {
    Image: (props: any) => <MockView {...props} />,
  };
});

const mockComputeDeductibleImpactCents = jest.fn();

jest.mock("@/domain/deductible-impact", () => ({
  computeDeductibleImpactCents: (
    item: unknown,
    settings: unknown,
    categoryMap: unknown,
    year: unknown
  ) => mockComputeDeductibleImpactCents(item, settings, categoryMap, year),
}));

const mockEstimateTaxImpact = jest.fn();
jest.mock("@/domain/calculation-engine", () => ({
  estimateTaxImpact: (...args: unknown[]) => mockEstimateTaxImpact(...args),
}));

let mockProfileSettingsStore: ProfileSettings = {
  taxYearDefault: 2026,
  marginalRateBps: 4_000,
  defaultWorkPercent: 100,
  gwgThresholdCents: 100_000,
  applyHalfYearRule: false,
  appLockEnabled: false,
  uploadToOneDriveAfterExport: false,
  themeModePreference: "system",
  currency: "EUR",
};

const mockCategoryStore: Array<{
  id: string;
  name: string;
  sortOrder: number;
  isPreset: boolean;
  defaultUsefulLifeMonths: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
}> = [
  {
    id: "cat-electronics",
    name: "Electronics",
    sortOrder: 0,
    isPreset: true,
    defaultUsefulLifeMonths: 36,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  },
];

let mockItemCounter = 0;
const mockItemStore: Item[] = [];
const mockItemReceiptsById = new Map<string, StoredAttachmentFile[]>();

const mockDraftStore = new Map<string, StoredAttachmentFile[]>();
let mockDraftCounter = 0;

const mockCameraAttachmentQueue: StoredAttachmentFile[] = [];

function mockItemHasReceipt(itemId: string): boolean {
  return (mockItemReceiptsById.get(itemId) ?? []).some((attachment) => attachment.type === "RECEIPT");
}

function mockNotesMissing(item: Item): boolean {
  return (item.usageType === "WORK" || item.usageType === "MIXED") && !item.notes?.trim();
}

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: async () => mockProfileSettingsStore,
    upsertSettings: async (values: {
      taxYearDefault: number;
      marginalRateBps: number;
      defaultWorkPercent: number;
      gwgThresholdCents: number;
      applyHalfYearRule: boolean;
      appLockEnabled: boolean;
      uploadToOneDriveAfterExport: boolean;
      themeModePreference?: "system" | "light" | "dark";
    }) => {
      mockProfileSettingsStore = {
        ...mockProfileSettingsStore,
        ...values,
        currency: "EUR",
      };
    },
  }),
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getCategoryRepository: async () => ({
    list: async () => [...mockCategoryStore],
    createCustomCategory: async ({ name }: { name: string }) => {
      const now = "2026-01-01T00:00:00.000Z";
      const created = {
        id: `cat-custom-${mockCategoryStore.length + 1}`,
        name,
        sortOrder: mockCategoryStore.length + 1,
        isPreset: false,
        defaultUsefulLifeMonths: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null as null,
      };
      mockCategoryStore.push(created);
      return created;
    },
  }),
  getItemRepository: async () => ({
    create: async (input: {
      title: string;
      purchaseDate: string;
      totalCents: number;
      usageType: ItemUsageType;
      workPercent?: number | null;
      categoryId?: string | null;
      vendor?: string | null;
      warrantyMonths?: number | null;
      notes?: string | null;
      usefulLifeMonthsOverride?: number | null;
    }) => {
      const id = `item-${++mockItemCounter}`;
      const now = "2026-01-15T10:30:00.000Z";
      const created: Item = {
        id,
        title: input.title,
        purchaseDate: input.purchaseDate,
        totalCents: input.totalCents,
        currency: "EUR",
        usageType: input.usageType,
        workPercent: input.workPercent ?? null,
        categoryId: input.categoryId ?? null,
        vendor: input.vendor ?? null,
        warrantyMonths: input.warrantyMonths ?? null,
        notes: input.notes ?? null,
        usefulLifeMonthsOverride: input.usefulLifeMonthsOverride ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      mockItemStore.push(created);
      return created;
    },
    list: async (filters?: {
      year?: number;
      usageType?: ItemUsageType;
      categoryId?: string;
      missingReceipt?: boolean;
      missingNotes?: boolean;
    }) => {
      return mockItemStore.filter((item) => {
        if (item.deletedAt !== null) {
          return false;
        }
        if (filters?.year !== undefined) {
          const itemYear = Number.parseInt(item.purchaseDate.slice(0, 4), 10);
          if (itemYear !== filters.year) {
            return false;
          }
        }
        if (filters?.usageType !== undefined && item.usageType !== filters.usageType) {
          return false;
        }
        if (filters?.categoryId !== undefined && item.categoryId !== filters.categoryId) {
          return false;
        }
        if (filters?.missingReceipt && mockItemHasReceipt(item.id)) {
          return false;
        }
        if (filters?.missingNotes && !mockNotesMissing(item)) {
          return false;
        }
        return true;
      });
    },
    listMissingReceiptItemIds: async (filters?: {
      year?: number;
      usageType?: ItemUsageType;
      categoryId?: string;
      missingNotes?: boolean;
    }) => {
      return mockItemStore
        .filter((item) => {
          if (item.deletedAt !== null) {
            return false;
          }
          if (filters?.year !== undefined) {
            const itemYear = Number.parseInt(item.purchaseDate.slice(0, 4), 10);
            if (itemYear !== filters.year) {
              return false;
            }
          }
          if (filters?.usageType !== undefined && item.usageType !== filters.usageType) {
            return false;
          }
          if (filters?.categoryId !== undefined && item.categoryId !== filters.categoryId) {
            return false;
          }
          if (filters?.missingNotes && !mockNotesMissing(item)) {
            return false;
          }
          return !mockItemHasReceipt(item.id);
        })
        .map((item) => item.id);
    },
    getById: async (id: string) => mockItemStore.find((item) => item.id === id && item.deletedAt === null) ?? null,
    softDelete: async (id: string) => {
      const index = mockItemStore.findIndex((item) => item.id === id);
      if (index >= 0) {
        mockItemStore[index] = {
          ...mockItemStore[index],
          deletedAt: "2026-01-15T10:30:00.000Z",
        };
      }
    },
  }),
  getAttachmentRepository: async () => ({
    listByItem: async (itemId: string) => {
      const attachments = mockItemReceiptsById.get(itemId) ?? [];
      return attachments.map((attachment, index) => ({
        id: `${itemId}-attachment-${index + 1}`,
        itemId,
        type: attachment.type,
        mimeType: attachment.mimeType,
        filePath: attachment.filePath,
        originalFileName: attachment.originalFileName,
        fileSizeBytes: attachment.fileSizeBytes,
        createdAt: "2026-01-15T10:30:00.000Z",
        updatedAt: "2026-01-15T10:30:00.000Z",
        deletedAt: null,
      }));
    },
  }),
}));

jest.mock("@/services/attachment-storage", () => ({
  saveFromCamera: async () => mockCameraAttachmentQueue.shift() ?? null,
  saveFromPicker: async () => null,
  attachmentFileExists: async () => true,
  resolveAttachmentPreviewUri: async (filePath: string) => filePath,
}));

jest.mock("@/services/item-service", () => ({
  deleteItemWithAttachments: (itemId: string) => mockDeleteItemWithAttachments(itemId),
}));

jest.mock("@/services/item-draft-store", () => ({
  createItemDraft: () => {
    const id = `draft-${++mockDraftCounter}`;
    mockDraftStore.set(id, []);
    return id;
  },
  getItemDraftAttachments: (draftId: string) => [...(mockDraftStore.get(draftId) ?? [])],
  addAttachmentToDraft: (draftId: string, attachment: StoredAttachmentFile) => {
    const current = mockDraftStore.get(draftId) ?? [];
    mockDraftStore.set(draftId, [...current, attachment]);
  },
  removeAttachmentFromDraft: async (draftId: string, filePath: string) => {
    const current = mockDraftStore.get(draftId) ?? [];
    mockDraftStore.set(
      draftId,
      current.filter((attachment) => attachment.filePath !== filePath)
    );
  },
  clearItemDraft: async (draftId: string) => {
    mockDraftStore.delete(draftId);
  },
  linkDraftAttachmentsToItem: async (draftId: string, itemId: string) => {
    const attachments = mockDraftStore.get(draftId) ?? [];
    mockItemReceiptsById.set(itemId, [...attachments]);
    mockDraftStore.delete(draftId);
  },
}));

interface PurchaseFlowInput {
  title: string;
  purchaseDate: string;
  price: string;
  vendor: string;
  notes: string;
  usage: ItemUsageType;
  workPercent?: string;
  receiptFileName: string;
}

async function createPurchaseViaUiFlow(input: PurchaseFlowInput): Promise<void> {
  mockLocalSearchParams = {};
  const view = render(<NewItemRoute />);

  await waitFor(() => {
    expect(typeof mockLocalSearchParams.draftId).toBe("string");
  });

  view.rerender(<NewItemRoute />);
  expect(await screen.findByText("Add Item")).toBeTruthy();

  fireEvent.press(screen.getByTestId("new-item-attachment-take-photo"));
  expect(await screen.findByText(input.receiptFileName)).toBeTruthy();

  fireEvent.changeText(screen.getByTestId("new-item-title-input"), input.title);
  fireEvent.changeText(screen.getByTestId("new-item-purchase-date-input"), input.purchaseDate);
  fireEvent.changeText(screen.getByTestId("new-item-total-price-input"), input.price);
  fireEvent.changeText(screen.getByTestId("new-item-vendor-input"), input.vendor);
  fireEvent.changeText(screen.getByTestId("new-item-notes-input"), input.notes);

  if (input.usage !== "WORK") {
    fireEvent.press(screen.getByTestId(`new-item-usage-${input.usage.toLowerCase()}`));
  }
  if (input.usage === "MIXED" && input.workPercent) {
    fireEvent.changeText(screen.getByTestId("new-item-work-percent-input"), input.workPercent);
  }

  fireEvent.press(screen.getByTestId("new-item-category-open"));
  fireEvent.press(screen.getByText("Electronics"));

  const countBeforeSave = mockItemStore.length;
  fireEvent.press(screen.getByTestId("action-add-item"));
  await waitFor(() => {
    expect(mockItemStore).toHaveLength(countBeforeSave + 1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/items");
  });

  view.unmount();
}

describe("App first-user UI journey", () => {
  beforeEach(() => {
    mockLocalSearchParams = {};
    mockPush.mockReset();
    mockReplace.mockReset();
    mockDeleteItemWithAttachments.mockReset();
    mockComputeDeductibleImpactCents.mockReset();
    mockEstimateTaxImpact.mockReset();
    mockComputeDeductibleImpactCents.mockImplementation((item: Item) => {
      if (item.usageType === "WORK") {
        return item.totalCents;
      }
      if (item.usageType === "MIXED") {
        return Math.round((item.totalCents * (item.workPercent ?? 0)) / 100);
      }
      return 0;
    });
    mockEstimateTaxImpact.mockReturnValue({
      deductibleThisYearCents: 1_000,
      estimatedRefundThisYearCents: 400,
      scheduleByYear: [{ year: 2026, deductibleCents: 1_000 }],
      explanations: [],
    });
    mockDeleteItemWithAttachments.mockImplementation(async (itemId: string) => {
      const index = mockItemStore.findIndex((item) => item.id === itemId);
      if (index >= 0) {
        mockItemStore.splice(index, 1);
      }
      mockItemReceiptsById.delete(itemId);
    });

    mockProfileSettingsStore = {
      taxYearDefault: 2026,
      marginalRateBps: 4_000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100_000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
    };

    mockCategoryStore.splice(1, mockCategoryStore.length);
    mockItemCounter = 0;
    mockItemStore.splice(0, mockItemStore.length);
    mockItemReceiptsById.clear();
    mockDraftStore.clear();
    mockDraftCounter = 0;
    mockCameraAttachmentQueue.splice(0, mockCameraAttachmentQueue.length);
  });

  it("walks from onboarding to creating TV and laptop invoices via real UI interactions", async () => {
    const welcomeView = render(<OnboardingWelcomeRoute />);
    expect(await screen.findByText("Welcome to SteuerFuchs")).toBeTruthy();
    fireEvent.press(screen.getByText("Continue to Profile Setup"));
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/profile-setup");
    welcomeView.unmount();

    const profileSetupView = render(<OnboardingProfileSetupRoute />);
    expect(await screen.findByText("Profile Setup")).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue("2026"), "2026");
    fireEvent.changeText(screen.getByDisplayValue("40"), "42");
    fireEvent.changeText(screen.getByDisplayValue("100"), "85");
    fireEvent.press(screen.getByText("Save and Continue"));

    await waitFor(() => {
      expect(mockProfileSettingsStore.taxYearDefault).toBe(2026);
      expect(mockProfileSettingsStore.marginalRateBps).toBe(4_200);
      expect(mockProfileSettingsStore.defaultWorkPercent).toBe(85);
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/home");
    });
    profileSetupView.unmount();

    const homeBeforeItems = render(<HomeRoute />);
    expect(await screen.findByText("No items added yet.")).toBeTruthy();
    expect(screen.getByText("Use the center + button to add your first item.")).toBeTruthy();
    expect(screen.queryByText("Go to Items")).toBeNull();
    expect(screen.queryByText("Add Item")).toBeNull();
    homeBeforeItems.unmount();

    mockCameraAttachmentQueue.push(
      {
        filePath: "file:///tmp/receipts/tv-rechnung.jpg",
        mimeType: "image/jpeg",
        originalFileName: "tv-rechnung.jpg",
        fileSizeBytes: 120_000,
        type: "PHOTO",
      },
      {
        filePath: "file:///tmp/receipts/laptop-rechnung.jpg",
        mimeType: "image/jpeg",
        originalFileName: "laptop-rechnung.jpg",
        fileSizeBytes: 180_000,
        type: "PHOTO",
      }
    );

    await createPurchaseViaUiFlow({
      title: "Samsung QLED TV 55",
      purchaseDate: "2026-03-02",
      price: "1299.00",
      vendor: "MediaMarkt Munich",
      notes: "Living room TV, mixed private/work usage",
      usage: "MIXED",
      workPercent: "40",
      receiptFileName: "tv-rechnung.jpg",
    });

    await createPurchaseViaUiFlow({
      title: "MacBook Pro 14",
      purchaseDate: "2026-04-18",
      price: "2499.00",
      vendor: "Cyberport Berlin",
      notes: "Primary work laptop for client projects",
      usage: "WORK",
      receiptFileName: "laptop-rechnung.jpg",
    });

    expect(mockItemStore).toHaveLength(2);
    expect(mockItemReceiptsById.get("item-1")?.[0]?.originalFileName).toBe("tv-rechnung.jpg");
    expect(mockItemReceiptsById.get("item-2")?.[0]?.originalFileName).toBe("laptop-rechnung.jpg");

    mockLocalSearchParams = {};
    const itemsView = render(<ItemsRoute />);
    expect(await screen.findByText("Samsung QLED TV 55")).toBeTruthy();
    expect(screen.getByText("MacBook Pro 14")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("items-search-input"), "Cyberport");
    await waitFor(() => {
      expect(screen.getByText("MacBook Pro 14")).toBeTruthy();
      expect(screen.queryByText("Samsung QLED TV 55")).toBeNull();
    });
    itemsView.unmount();

    const homeAfterItems = render(<HomeRoute />);
    expect(await screen.findByText("Steuerausgleich 2026")).toBeTruthy();
    expect(screen.queryByText("No items added yet.")).toBeNull();
    homeAfterItems.unmount();
  });

  it("deletes an item from detail view and it no longer appears in items list", async () => {
    mockCameraAttachmentQueue.push({
      filePath: "file:///tmp/receipts/printer-rechnung.jpg",
      mimeType: "image/jpeg",
      originalFileName: "printer-rechnung.jpg",
      fileSizeBytes: 99_000,
      type: "PHOTO",
    });

    await createPurchaseViaUiFlow({
      title: "Office Printer",
      purchaseDate: "2026-06-10",
      price: "399.00",
      vendor: "Saturn Vienna",
      notes: "Shared office printer",
      usage: "WORK",
      receiptFileName: "printer-rechnung.jpg",
    });

    expect(mockItemStore).toHaveLength(1);
    expect(mockItemStore[0].title).toBe("Office Printer");

    mockLocalSearchParams = { id: mockItemStore[0].id };
    const detailView = render(<ItemDetailRoute />);
    expect((await screen.findAllByText("Office Printer")).length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId("item-detail-delete"));
    fireEvent.press(screen.getByTestId("item-detail-delete-confirm"));

    await waitFor(() => {
      expect(mockDeleteItemWithAttachments).toHaveBeenCalledWith("item-1");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/items");
      expect(mockItemStore).toHaveLength(0);
    });
    detailView.unmount();

    mockLocalSearchParams = {};
    const itemsView = render(<ItemsRoute />);
    expect(await screen.findByText("No items found. Adjust filters or add a new item.")).toBeTruthy();
    expect(screen.queryByText("Office Printer")).toBeNull();
    itemsView.unmount();
  });
});
