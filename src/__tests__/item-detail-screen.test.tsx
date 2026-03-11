import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ItemDetailRoute from "@/app/item/[id]";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
const mockGetById = jest.fn();
const mockSoftDelete = jest.fn();
const mockListAttachments = jest.fn();
const mockListCategories = jest.fn();
const mockGetSettings = jest.fn();
const mockEstimateTaxImpact = jest.fn();
const mockAttachmentFileExists = jest.fn();
const mockResolveAttachmentPreviewUri = jest.fn();
const mockDeleteAttachment = jest.fn();
const mockNavigationSetOptions = jest.fn();
const baseItem = {
  id: "item-1",
  title: "Work laptop",
  purchaseDate: "2026-02-10",
  totalCents: 200_000,
  currency: "EUR",
  usageType: "WORK" as const,
  workPercent: null as number | null,
  categoryId: "cat-1",
  vendor: "ACME",
  warrantyMonths: 24,
  notes: "Invoice kept",
  usefulLifeMonthsOverride: null,
  createdAt: "2026-02-11T09:00:00.000Z",
  updatedAt: "2026-02-11T09:00:00.000Z",
  deletedAt: null,
};

jest.mock("@gluestack-ui/themed", () => {
  const {
    ActivityIndicator: MockActivityIndicator,
    Pressable: MockPressable,
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
    Badge: Block,
    BadgeText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Box: Block,
    Button: ({ children, ...props }: any) => <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>,
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Card: Block,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    HStack: Block,
    Modal: ({ isOpen, children }: any) => (isOpen ? <MockView>{children}</MockView> : null),
    ModalBackdrop: Block,
    ModalBody: Block,
    ModalContent: Block,
    Pressable: ({ children, ...props }: any) => <MockPressable {...props}>{children}</MockPressable>,
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
  };
});

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: any) => <View {...props} />,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => ({ id: "item-1" }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    setOptions: mockNavigationSetOptions,
  }),
}));

jest.mock("@/domain/calculation-engine", () => ({
  estimateTaxImpact: (...args: unknown[]) => mockEstimateTaxImpact(...args),
}));

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    background: "#ffffff",
    backgroundElement: "#f3f4f6",
    text: "#111827",
    textSecondary: "#6b7280",
    border: "#d1d5db",
    primary: "#2563eb",
    danger: "#dc2626",
    textOnPrimary: "#ffffff",
  }),
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getItemRepository: async () => ({
    getById: (id: string) => mockGetById(id),
    softDelete: (id: string) => mockSoftDelete(id),
  }),
  getAttachmentRepository: async () => ({
    listByItem: (itemId: string) => mockListAttachments(itemId),
  }),
  getCategoryRepository: async () => ({
    list: () => mockListCategories(),
  }),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: () => mockGetSettings(),
  }),
}));

jest.mock("@/services/attachment-storage", () => ({
  attachmentFileExists: (filePath: string) => mockAttachmentFileExists(filePath),
  resolveAttachmentPreviewUri: (filePath: string, mimeType: string) =>
    mockResolveAttachmentPreviewUri(filePath, mimeType),
}));

jest.mock("@/services/attachment-service", () => ({
  deleteAttachment: (id: string) => mockDeleteAttachment(id),
}));

describe("ItemDetailRoute", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockNavigationSetOptions.mockReset();
    mockCanGoBack = true;
    mockGetById.mockReset();
    mockSoftDelete.mockReset();
    mockListAttachments.mockReset();
    mockListCategories.mockReset();
    mockGetSettings.mockReset();
    mockEstimateTaxImpact.mockReset();
    mockAttachmentFileExists.mockReset();
    mockResolveAttachmentPreviewUri.mockReset();
    mockDeleteAttachment.mockReset();

    mockGetById.mockResolvedValue({ ...baseItem });
    mockListAttachments.mockResolvedValue([
      {
        id: "att-missing",
        itemId: "item-1",
        type: "RECEIPT",
        mimeType: "image/jpeg",
        filePath: "/missing.jpg",
        originalFileName: "missing.jpg",
        fileSizeBytes: 1_000,
        createdAt: "2026-02-11T09:00:00.000Z",
        updatedAt: "2026-02-11T09:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "att-pdf",
        itemId: "item-1",
        type: "RECEIPT",
        mimeType: "application/pdf",
        filePath: "/receipt.pdf",
        originalFileName: "receipt.pdf",
        fileSizeBytes: 2_000,
        createdAt: "2026-02-11T09:00:00.000Z",
        updatedAt: "2026-02-11T09:00:00.000Z",
        deletedAt: null,
      },
    ]);
    mockListCategories.mockResolvedValue([
      {
        id: "cat-1",
        name: "Laptop/Computer",
        sortOrder: 0,
        isPreset: true,
        defaultUsefulLifeMonths: 36,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
      },
    ]);
    mockGetSettings.mockResolvedValue({
      id: "profile",
      taxYearDefault: 2026,
      marginalRateBps: 4_000,
      defaultWorkPercent: 100,
      gwgThresholdCents: 100_000,
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
      themeModePreference: "system",
      currency: "EUR",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    });
    mockEstimateTaxImpact.mockReturnValue({
      deductibleThisYearCents: 120_000,
      estimatedRefundThisYearCents: 48_000,
      scheduleByYear: [{ year: 2026, deductibleCents: 120_000 }],
      explanations: [],
    });
    mockAttachmentFileExists.mockImplementation(async (filePath: string) => filePath !== "/missing.jpg");
    mockResolveAttachmentPreviewUri.mockImplementation(async (filePath: string) => filePath);
    mockDeleteAttachment.mockResolvedValue(undefined);
    mockSoftDelete.mockResolvedValue(undefined);
  });

  it("renders contract sections and missing attachment placeholder", async () => {
    render(<ItemDetailRoute />);

    expect((await screen.findAllByText("Work laptop")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("item-usage-badge")).toBeTruthy();
    expect(screen.getByText("WORK")).toBeTruthy();
    expect(screen.getByText("Attachment gallery")).toBeTruthy();
    expect(screen.getByText("Info")).toBeTruthy();
    expect(screen.getByText("% Work")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Calculation")).toBeTruthy();
    expect(screen.getByText("File unavailable")).toBeTruthy();
    expect(screen.getAllByText("Missing file").length).toBeGreaterThan(0);

    expect(screen.getByText("Deductible base")).toBeTruthy();
    expect(screen.getByText("Deductible this year")).toBeTruthy();
    expect(screen.getByText("Estimated refund impact")).toBeTruthy();
    expect(screen.getByText("Schedule by year")).toBeTruthy();
    expect(screen.getByText("2026")).toBeTruthy();
  });

  it("wires edit action into native header and navigates to edit screen", async () => {
    render(<ItemDetailRoute />);

    expect((await screen.findAllByText("Work laptop")).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(mockNavigationSetOptions).toHaveBeenCalledWith(
        expect.objectContaining({ headerRight: expect.any(Function) })
      );
    });

    const options = mockNavigationSetOptions.mock.calls[
      mockNavigationSetOptions.mock.calls.length - 1
    ][0] as { headerRight?: () => React.ReactElement };

    const headerRight = options.headerRight?.() as
      | React.ReactElement<{ testID?: string; onPress?: () => void }>
      | undefined;
    expect(headerRight?.props.testID).toBe("item-detail-header-edit");
    headerRight?.props.onPress?.();

    expect(mockPush).toHaveBeenCalledWith("/item/item-1/edit");
  });

  it("renders % Work as 0% for PRIVATE usage", async () => {
    mockGetById.mockResolvedValueOnce({
      ...baseItem,
      usageType: "PRIVATE",
      workPercent: null,
    });

    render(<ItemDetailRoute />);

    expect((await screen.findAllByText("Work laptop")).length).toBeGreaterThan(0);
    expect(screen.getByText("% Work")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("renders % Work from selected percent for MIXED usage", async () => {
    mockGetById.mockResolvedValueOnce({
      ...baseItem,
      usageType: "MIXED",
      workPercent: 70,
    });

    render(<ItemDetailRoute />);

    expect((await screen.findAllByText("Work laptop")).length).toBeGreaterThan(0);
    expect(screen.getByText("% Work")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
  });

  it("deletes item after confirmation dialog", async () => {
    render(<ItemDetailRoute />);

    expect((await screen.findAllByText("Work laptop")).length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId("item-detail-delete"));
    expect(screen.getByText("Delete item?")).toBeTruthy();

    fireEvent.press(screen.getByTestId("item-detail-delete-confirm"));

    await waitFor(() => {
      expect(mockDeleteAttachment).toHaveBeenCalledTimes(2);
      expect(mockSoftDelete).toHaveBeenCalledWith("item-1");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/items");
    });
  });

  it("shows back-to-items fallback when no history exists", async () => {
    mockCanGoBack = false;
    render(<ItemDetailRoute />);

    expect((await screen.findAllByText("Work laptop")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("item-detail-back-to-items")).toBeTruthy();

    fireEvent.press(screen.getByTestId("item-detail-back-to-items"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/items");
    });
  });
});
