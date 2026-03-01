import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import NewItemRoute from "@/app/item/new";

const mockRouterReplace = jest.fn();
const mockRouter = { replace: mockRouterReplace };
const mockRouteParams: { draftId?: string } = {
  draftId: "draft-1",
};

const mockListCategories = jest.fn();
const mockCreateCustomCategory = jest.fn();
const mockCreateItem = jest.fn();
const mockGetCategoryRepository = jest.fn();
const mockGetItemRepository = jest.fn();

const mockSaveFromCamera = jest.fn();
const mockSaveFromPicker = jest.fn();
const mockAddAttachmentToDraft = jest.fn();
const mockGetItemDraftAttachments = jest.fn();
const mockClearItemDraft = jest.fn();
const mockLinkDraftAttachmentsToItem = jest.fn();

const mockDraftAttachments: Array<{
  filePath: string;
  mimeType: string;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  type: "RECEIPT" | "PHOTO";
}> = [];

jest.mock("@gluestack-ui/themed", () => {
  const {
    ActivityIndicator: MockActivityIndicator,
    Text: MockText,
    TextInput: MockTextInput,
    TouchableOpacity: MockTouchableOpacity,
    View: MockView,
  } = require("react-native");

  const MockContainer = ({ children, testID, ...props }: any) => (
    <MockView testID={testID} {...props}>
      {children}
    </MockView>
  );

  return {
    Actionsheet: ({ isOpen, children }: any) => (isOpen ? <MockView>{children}</MockView> : null),
    ActionsheetBackdrop: MockContainer,
    ActionsheetContent: MockContainer,
    ActionsheetDragIndicator: MockContainer,
    ActionsheetDragIndicatorWrapper: MockContainer,
    ActionsheetItem: ({ children, ...props }: any) => (
      <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>
    ),
    ActionsheetItemText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Badge: MockContainer,
    BadgeText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Box: MockContainer,
    Button: ({ children, ...props }: any) => <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>,
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Card: MockContainer,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    HStack: MockContainer,
    Input: MockContainer,
    InputField: (props: any) => <MockTextInput {...props} />,
    Slider: MockContainer,
    SliderFilledTrack: MockContainer,
    SliderThumb: MockContainer,
    SliderTrack: MockContainer,
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Textarea: MockContainer,
    TextareaInput: (props: any) => <MockTextInput {...props} />,
    VStack: MockContainer,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getCategoryRepository: () => mockGetCategoryRepository(),
  getItemRepository: () => mockGetItemRepository(),
}));

jest.mock("@/services/attachment-storage", () => ({
  saveFromCamera: () => mockSaveFromCamera(),
  saveFromPicker: () => mockSaveFromPicker(),
}));

jest.mock("@/services/item-draft-store", () => ({
  addAttachmentToDraft: (...args: unknown[]) => mockAddAttachmentToDraft(...args),
  clearItemDraft: (draftId: string) => mockClearItemDraft(draftId),
  createItemDraft: () => "draft-generated",
  getItemDraftAttachments: (draftId: string) => mockGetItemDraftAttachments(draftId),
  linkDraftAttachmentsToItem: (...args: unknown[]) => mockLinkDraftAttachmentsToItem(...args),
  removeAttachmentFromDraft: jest.fn(),
}));

describe("NewItemRoute save and validation", () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();

    mockListCategories.mockReset();
    mockCreateCustomCategory.mockReset();
    mockCreateItem.mockReset();
    mockGetCategoryRepository.mockReset();
    mockGetItemRepository.mockReset();

    mockSaveFromCamera.mockReset();
    mockSaveFromPicker.mockReset();
    mockAddAttachmentToDraft.mockReset();
    mockGetItemDraftAttachments.mockReset();
    mockClearItemDraft.mockReset();
    mockLinkDraftAttachmentsToItem.mockReset();
    mockDraftAttachments.splice(0, mockDraftAttachments.length);

    mockGetCategoryRepository.mockResolvedValue({
      list: mockListCategories,
      createCustomCategory: mockCreateCustomCategory,
    });
    mockGetItemRepository.mockResolvedValue({
      create: mockCreateItem,
    });

    mockListCategories.mockResolvedValue([]);
    mockCreateCustomCategory.mockResolvedValue({
      id: "cat-custom-1",
      name: "Custom",
    });

    mockSaveFromCamera.mockResolvedValue(null);
    mockSaveFromPicker.mockResolvedValue(null);
    mockGetItemDraftAttachments.mockImplementation(() => [...mockDraftAttachments]);
    mockAddAttachmentToDraft.mockImplementation((_draftId: string, attachment: any) => {
      mockDraftAttachments.push(attachment);
    });
    mockClearItemDraft.mockResolvedValue(undefined);
    mockLinkDraftAttachmentsToItem.mockResolvedValue(undefined);

    mockCreateItem.mockResolvedValue({ id: "item-123" });
  });

  it("supports add-item happy path from attachment to successful save and routes to items tab", async () => {
    mockSaveFromCamera.mockResolvedValue({
      filePath: "/tmp/receipt-a.jpg",
      mimeType: "image/jpeg",
      originalFileName: "receipt-a.jpg",
      fileSizeBytes: 42_000,
      type: "PHOTO",
    });

    render(<NewItemRoute />);
    expect(await screen.findByText("Add Item")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-item-attachment-take-photo"));

    await waitFor(() => {
      expect(mockSaveFromCamera).toHaveBeenCalledTimes(1);
      expect(mockAddAttachmentToDraft).toHaveBeenCalledWith(
        "draft-1",
        expect.objectContaining({ filePath: "/tmp/receipt-a.jpg", type: "RECEIPT" })
      );
      expect(screen.getByText("receipt-a.jpg")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId("new-item-title-input"), "  Work monitor  ");
    fireEvent.changeText(screen.getByTestId("new-item-purchase-date-input"), "2026-01-15");
    fireEvent.changeText(screen.getByTestId("new-item-total-price-input"), "499.99");
    fireEvent.changeText(screen.getByTestId("new-item-vendor-input"), "  Saturn  ");
    fireEvent.changeText(screen.getByTestId("new-item-notes-input"), "  invoice attached  ");

    fireEvent.press(screen.getByTestId("new-item-save"));

    await waitFor(() => {
      expect(mockCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Work monitor",
          purchaseDate: "2026-01-15",
          totalCents: 49_999,
          usageType: "WORK",
          workPercent: null,
          vendor: "Saturn",
          notes: "invoice attached",
        })
      );
    });
    await waitFor(() => {
      expect(mockLinkDraftAttachmentsToItem).toHaveBeenCalledWith("draft-1", "item-123");
      expect(mockRouterReplace).toHaveBeenCalledWith("/(tabs)/items");
    });
  });

  it("blocks save when required fields are invalid", async () => {
    render(<NewItemRoute />);

    expect(await screen.findByText("Add Item")).toBeTruthy();
    expect(screen.getByText("Title is required.")).toBeTruthy();
    expect(screen.getByText("Total price is required and must be greater than 0.")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-item-save"));

    await waitFor(() => {
      expect(mockCreateItem).not.toHaveBeenCalled();
      expect(mockLinkDraftAttachmentsToItem).not.toHaveBeenCalled();
    });
  });

  it("blocks save for MIXED usage when work percent is missing", async () => {
    render(<NewItemRoute />);

    expect(await screen.findByText("Add Item")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("new-item-title-input"), "Mixed use tablet");
    fireEvent.changeText(screen.getByTestId("new-item-total-price-input"), "899.00");
    fireEvent.press(screen.getByTestId("new-item-usage-mixed"));

    fireEvent.press(screen.getByTestId("new-item-save"));

    await waitFor(() => {
      expect(screen.getByText("Work percent is required for mixed usage.")).toBeTruthy();
      expect(mockCreateItem).not.toHaveBeenCalled();
      expect(mockLinkDraftAttachmentsToItem).not.toHaveBeenCalled();
    });
  });
});
