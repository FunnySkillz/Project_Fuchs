import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Keyboard, ScrollView } from "react-native";

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
const mockNavigationAddListener = jest.fn();
const mockNavigationDispatch = jest.fn();

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

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactModule = require("react");
    ReactModule.useEffect(() => callback(), [callback]);
  },
  useNavigation: () => ({
    addListener: mockNavigationAddListener,
    dispatch: mockNavigationDispatch,
  }),
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
    mockNavigationAddListener.mockReset();
    mockNavigationDispatch.mockReset();
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
    mockNavigationAddListener.mockReturnValue(jest.fn());

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
    expect(await screen.findByText("Attachments")).toBeTruthy();

    fireEvent.press(screen.getByTestId("additem-btn-takephoto"));

    await waitFor(() => {
      expect(mockSaveFromCamera).toHaveBeenCalledTimes(1);
      expect(mockAddAttachmentToDraft).toHaveBeenCalledWith(
        "draft-1",
        expect.objectContaining({ filePath: "/tmp/receipt-a.jpg", type: "RECEIPT" })
      );
      expect(screen.getByText("receipt-a.jpg")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId("additem-input-title"), "  Work monitor  ");
    fireEvent.changeText(screen.getByTestId("additem-input-purchaseDate"), "2026-01-15");
    fireEvent.changeText(screen.getByTestId("additem-input-price"), "499.99");
    fireEvent.changeText(screen.getByTestId("additem-input-vendor"), "  Saturn  ");
    fireEvent.changeText(screen.getByTestId("additem-input-notes"), "  invoice attached  ");

    fireEvent.press(screen.getByTestId("additem-btn-save"));

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

  it("shows price required error after submit attempt when price is empty", async () => {
    render(<NewItemRoute />);

    expect(await screen.findByText("Attachments")).toBeTruthy();

    const saveButton = screen.getByTestId("additem-btn-save");
    expect(saveButton.props.accessibilityState?.disabled).not.toBe(true);
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("additem-error-price")).toBeTruthy();
      expect(screen.getByText("Price is required and must be greater than 0.")).toBeTruthy();
      expect(screen.getByTestId("additem-btn-save").props.accessibilityState?.disabled).toBe(true);
    });

    expect(mockCreateItem).not.toHaveBeenCalled();
    expect(mockLinkDraftAttachmentsToItem).not.toHaveBeenCalled();
  });

  it("shows price required error when price is 0", async () => {
    render(<NewItemRoute />);

    expect(await screen.findByText("Attachments")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("additem-input-title"), "Desk Lamp");
    fireEvent.changeText(screen.getByTestId("additem-input-price"), "0");

    fireEvent.press(screen.getByTestId("additem-btn-save"));

    await waitFor(() => {
      expect(screen.getByTestId("additem-error-price")).toBeTruthy();
      expect(screen.getByText("Price is required and must be greater than 0.")).toBeTruthy();
    });
    expect(mockCreateItem).not.toHaveBeenCalled();
  });

  it("removes price error and enables save when price becomes valid", async () => {
    render(<NewItemRoute />);

    expect(await screen.findByText("Attachments")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("additem-input-title"), "Desk Lamp");

    fireEvent.press(screen.getByTestId("additem-btn-save"));
    await waitFor(() => {
      expect(screen.getByTestId("additem-error-price")).toBeTruthy();
      expect(screen.getByTestId("additem-btn-save").props.accessibilityState?.disabled).toBe(true);
    });

    fireEvent.changeText(screen.getByTestId("additem-input-price"), "149.99");

    await waitFor(() => {
      expect(screen.queryByTestId("additem-error-price")).toBeNull();
      expect(screen.getByTestId("additem-btn-save").props.accessibilityState?.disabled).not.toBe(true);
    });
  });

  it("requires work percent for MIXED usage before enabling save", async () => {
    render(<NewItemRoute />);

    expect(await screen.findByText("Attachments")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("additem-input-title"), "Mixed use tablet");
    fireEvent.changeText(screen.getByTestId("additem-input-price"), "899.00");
    fireEvent.press(screen.getByTestId("additem-seg-usage-mixed"));

    await waitFor(() => {
      expect(screen.getByTestId("additem-input-workpercent")).toBeTruthy();
    });

    fireEvent(screen.getByTestId("additem-input-workpercent"), "blur");
    fireEvent.press(screen.getByTestId("additem-btn-save"));

    await waitFor(() => {
      expect(screen.getByText("Work percent is required for mixed usage.")).toBeTruthy();
      expect(screen.getByTestId("additem-btn-save").props.accessibilityState?.disabled).toBe(true);
      expect(mockCreateItem).not.toHaveBeenCalled();
      expect(mockLinkDraftAttachmentsToItem).not.toHaveBeenCalled();
    });
  });

  it("does not scroll to top on warranty focus", async () => {
    const addListenerSpy = jest.spyOn(Keyboard, "addListener");

    const scrollViewProto = ScrollView.prototype as ScrollView & { scrollTo?: (...args: unknown[]) => void };
    const originalScrollTo = scrollViewProto.scrollTo;
    const scrollToMock = jest.fn();
    scrollViewProto.scrollTo = scrollToMock;

    try {
      render(<NewItemRoute />);
      expect(await screen.findByText("Attachments")).toBeTruthy();

      fireEvent(screen.getByTestId("additem-input-warrantymonths"), "focus");
      expect(scrollToMock).not.toHaveBeenCalled();
    } finally {
      scrollViewProto.scrollTo = originalScrollTo;
      addListenerSpy.mockRestore();
    }
  });
});
