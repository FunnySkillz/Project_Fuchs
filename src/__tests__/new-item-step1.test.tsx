import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import NewItemRoute from "@/app/item/new";

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
let mockRouterCanGoBack = false;
const mockNavigationGoBack = jest.fn();
let mockNavigationCanGoBack = false;
const mockRouter = {
  replace: mockRouterReplace,
  back: mockRouterBack,
  canGoBack: () => mockRouterCanGoBack,
};
const mockGetCategoryRepository = jest.fn();
const mockCreateItem = jest.fn();
const mockSaveFromCamera = jest.fn();
const mockSaveFromPicker = jest.fn();
const mockDeleteLocalAttachmentFile = jest.fn();
const mockClearItemDraft = jest.fn();
const mockAddAttachmentToDraft = jest.fn();
const mockGetItemDraftAttachments = jest.fn();
const mockNavigationAddListener = jest.fn();
const mockNavigationDispatch = jest.fn();
let beforeRemoveHandler: ((event: any) => void) | null = null;
let mockOpenSettingsSpy: jest.SpyInstance<Promise<void>, []>;
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
    Box: Block,
    Button: ({ children, ...props }: any) => <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>,
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Card: Block,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    HStack: Block,
    Input: Block,
    InputField: (props: any) => <MockTextInput {...props} />,
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Textarea: Block,
    TextareaInput: (props: any) => <MockTextInput {...props} />,
    VStack: Block,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({
    draftId: "draft-1",
  }),
  useSegments: () => ["item"],
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
    canGoBack: () => mockNavigationCanGoBack,
    goBack: mockNavigationGoBack,
    dispatch: mockNavigationDispatch,
  }),
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getCategoryRepository: () => mockGetCategoryRepository(),
  getItemRepository: async () => ({
    create: mockCreateItem,
  }),
}));

jest.mock("@/services/attachment-storage", () => ({
  saveFromCamera: () => mockSaveFromCamera(),
  saveFromPicker: () => mockSaveFromPicker(),
  deleteLocalAttachmentFile: (filePath: string) => mockDeleteLocalAttachmentFile(filePath),
}));

jest.mock("@/services/item-draft-store", () => ({
  addAttachmentToDraft: (...args: unknown[]) => mockAddAttachmentToDraft(...args),
  clearItemDraft: (draftId: string) => mockClearItemDraft(draftId),
  createItemDraft: () => "draft-new",
  getItemDraftAttachments: (draftId: string) => mockGetItemDraftAttachments(draftId),
  linkDraftAttachmentsToItem: jest.fn(),
  removeAttachmentFromDraft: jest.fn(),
}));

async function openAttachmentActions(): Promise<void> {
  fireEvent.press(screen.getByTestId("additem-btn-addreceipt"));
  await waitFor(() => {
    expect(screen.getByTestId("additem-btn-takephoto")).toBeTruthy();
  });
}

describe("NewItemRoute attachments and cancel behavior", () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockRouterBack.mockReset();
    mockRouterCanGoBack = false;
    mockNavigationGoBack.mockReset();
    mockNavigationCanGoBack = false;
    mockGetCategoryRepository.mockReset();
    mockCreateItem.mockReset();
    mockSaveFromCamera.mockReset();
    mockSaveFromPicker.mockReset();
    mockDeleteLocalAttachmentFile.mockReset();
    mockClearItemDraft.mockReset();
    mockAddAttachmentToDraft.mockReset();
    mockGetItemDraftAttachments.mockReset();
    mockNavigationAddListener.mockReset();
    mockNavigationDispatch.mockReset();
    beforeRemoveHandler = null;
    mockDraftAttachments.splice(0, mockDraftAttachments.length);
    if (mockOpenSettingsSpy) {
      mockOpenSettingsSpy.mockRestore();
    }
    mockOpenSettingsSpy = jest.spyOn(Linking, "openSettings").mockResolvedValue();

    mockGetCategoryRepository.mockResolvedValue({
      list: jest.fn().mockResolvedValue([]),
    });

    mockSaveFromPicker.mockResolvedValue(null);
    mockClearItemDraft.mockImplementation(async () => {
      for (const attachment of mockDraftAttachments) {
        await mockDeleteLocalAttachmentFile(attachment.filePath);
      }
      mockDraftAttachments.splice(0, mockDraftAttachments.length);
    });
    mockAddAttachmentToDraft.mockImplementation((_draftId: string, attachment: any) => {
      mockDraftAttachments.push(attachment);
    });
    mockGetItemDraftAttachments.mockImplementation(() => [...mockDraftAttachments]);
    mockNavigationAddListener.mockImplementation((eventName: string, handler: (event: any) => void) => {
      if (eventName === "beforeRemove") {
        beforeRemoveHandler = handler;
      }
      return jest.fn();
    });
  });

  afterEach(() => {
    mockOpenSettingsSpy.mockRestore();
  });

  it("clears draft attachments on cancel after taking a photo", async () => {
    mockSaveFromCamera.mockResolvedValue({
      filePath: "/tmp/receipt-a.jpg",
      mimeType: "image/jpeg",
      originalFileName: "receipt-a.jpg",
      fileSizeBytes: 42_000,
      type: "PHOTO",
    });

    render(<NewItemRoute />);

    expect(await screen.findByText("Attachments")).toBeTruthy();

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-takephoto"));

    await waitFor(() => {
      expect(mockAddAttachmentToDraft).toHaveBeenCalled();
      expect(screen.getByText("receipt-a.jpg")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("additem-btn-cancel"));
    expect(screen.getByTestId("discard-modal")).toBeTruthy();
    fireEvent.press(screen.getByTestId("discard-confirm"));

    await waitFor(() => {
      expect(mockClearItemDraft).toHaveBeenCalledWith("draft-1");
      expect(mockDeleteLocalAttachmentFile).toHaveBeenCalledWith("/tmp/receipt-a.jpg");
      expect(mockCreateItem).not.toHaveBeenCalled();
      expect(mockNavigationGoBack).not.toHaveBeenCalled();
      expect(mockRouterReplace).toHaveBeenCalledWith("/(tabs)/items");
    });
  });

  it("cleans draft files when leaving the route without pressing cancel", async () => {
    mockSaveFromPicker.mockResolvedValue({
      filePath: "/tmp/receipt-exit.pdf",
      mimeType: "application/pdf",
      originalFileName: "receipt-exit.pdf",
      fileSizeBytes: 12_000,
      type: "RECEIPT",
    });

    const view = render(<NewItemRoute />);
    expect(await screen.findByText("Attachments")).toBeTruthy();

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-upload"));
    await waitFor(() => {
      expect(mockAddAttachmentToDraft).toHaveBeenCalled();
      expect(screen.getByText("receipt-exit.pdf")).toBeTruthy();
    });

    view.unmount();

    await waitFor(() => {
      expect(mockClearItemDraft).toHaveBeenCalledWith("draft-1");
      expect(mockDeleteLocalAttachmentFile).toHaveBeenCalledWith("/tmp/receipt-exit.pdf");
    });
  });

  it("shows open settings action when camera permission is denied", async () => {
    mockSaveFromCamera.mockRejectedValue(
      new Error(
        "Camera permission denied. Enable camera access in your device settings to capture receipt photos."
      )
    );

    render(<NewItemRoute />);
    expect(await screen.findByText("Attachments")).toBeTruthy();

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-takephoto"));

    await waitFor(() => {
      expect(screen.getByText(/Camera access is denied/i)).toBeTruthy();
      expect(screen.getByTestId("new-item-open-settings")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("new-item-open-settings"));
    await waitFor(() => {
      expect(mockOpenSettingsSpy).toHaveBeenCalled();
    });
  });

  it("treats canceled picker exceptions as no-op with no error UI", async () => {
    mockSaveFromPicker.mockRejectedValue(new Error("User canceled document picker"));

    render(<NewItemRoute />);
    expect(await screen.findByText("Attachments")).toBeTruthy();

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-upload"));

    await waitFor(() => {
      expect(mockAddAttachmentToDraft).not.toHaveBeenCalled();
      expect(screen.queryByText("Action canceled.")).toBeNull();
    });
  });

  it("shows discard confirmation on navigation back when form is dirty", async () => {
    mockSaveFromCamera.mockResolvedValue({
      filePath: "/tmp/receipt-back.jpg",
      mimeType: "image/jpeg",
      originalFileName: "receipt-back.jpg",
      fileSizeBytes: 31_000,
      type: "PHOTO",
    });

    render(<NewItemRoute />);
    expect(await screen.findByText("Attachments")).toBeTruthy();

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-takephoto"));
    await waitFor(() => {
      expect(mockAddAttachmentToDraft).toHaveBeenCalled();
    });

    expect(beforeRemoveHandler).not.toBeNull();
    const preventDefault = jest.fn();
    await act(async () => {
      beforeRemoveHandler?.({
        preventDefault,
        data: {
          action: { type: "GO_BACK" },
        },
      });
    });

    expect(preventDefault).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("discard-modal")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("discard-confirm"));

    await waitFor(() => {
      expect(mockClearItemDraft).toHaveBeenCalledWith("draft-1");
      expect(mockNavigationDispatch).toHaveBeenCalledWith({ type: "GO_BACK" });
      expect(mockRouterReplace).not.toHaveBeenCalledWith("/(tabs)/items");
    });
  });

  it("uses navigation goBack on cancel-discard when history exists", async () => {
    mockNavigationCanGoBack = true;
    mockSaveFromCamera.mockResolvedValue({
      filePath: "/tmp/receipt-backstack.jpg",
      mimeType: "image/jpeg",
      originalFileName: "receipt-backstack.jpg",
      fileSizeBytes: 31_000,
      type: "PHOTO",
    });

    render(<NewItemRoute />);
    expect(await screen.findByText("Attachments")).toBeTruthy();

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-takephoto"));
    await waitFor(() => {
      expect(mockAddAttachmentToDraft).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId("additem-btn-cancel"));
    expect(screen.getByTestId("discard-modal")).toBeTruthy();
    fireEvent.press(screen.getByTestId("discard-confirm"));

    await waitFor(() => {
      expect(mockClearItemDraft).toHaveBeenCalledWith("draft-1");
      expect(mockNavigationGoBack).toHaveBeenCalled();
      expect(mockRouterReplace).not.toHaveBeenCalledWith("/(tabs)/items");
      expect(mockRouterBack).not.toHaveBeenCalled();
    });
  });

  it("allows clean navigation back without intercepting remove", async () => {
    mockRouterCanGoBack = false;
    mockNavigationCanGoBack = false;
    render(<NewItemRoute />);
    expect(await screen.findByText("Attachments")).toBeTruthy();

    expect(beforeRemoveHandler).not.toBeNull();
    const preventDefault = jest.fn();
    await act(async () => {
      beforeRemoveHandler?.({
        preventDefault,
        data: {
          action: { type: "GO_BACK" },
        },
      });
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("discard-modal")).toBeNull();
  });

  it("uses one Add receipt action sheet and maps every action to existing handlers", async () => {
    mockSaveFromCamera
      .mockResolvedValueOnce({
        filePath: "/tmp/receipt-main.jpg",
        mimeType: "image/jpeg",
        originalFileName: "receipt-main.jpg",
        fileSizeBytes: 48_000,
        type: "PHOTO",
      })
      .mockResolvedValueOnce({
        filePath: "/tmp/extra-photo.jpg",
        mimeType: "image/jpeg",
        originalFileName: "extra-photo.jpg",
        fileSizeBytes: 23_000,
        type: "PHOTO",
      });
    mockSaveFromPicker.mockResolvedValueOnce({
      filePath: "/tmp/receipt-upload.pdf",
      mimeType: "application/pdf",
      originalFileName: "receipt-upload.pdf",
      fileSizeBytes: 11_000,
      type: "RECEIPT",
    });

    render(<NewItemRoute />);
    expect(await screen.findByText("Attachments")).toBeTruthy();
    expect(screen.getByTestId("additem-btn-addreceipt")).toBeTruthy();
    expect(screen.queryByTestId("additem-btn-takephoto")).toBeNull();
    expect(screen.queryByTestId("additem-btn-upload")).toBeNull();

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-takephoto"));
    await waitFor(() => {
      expect(mockSaveFromCamera).toHaveBeenCalledTimes(1);
      expect(mockAddAttachmentToDraft).toHaveBeenCalledWith(
        "draft-1",
        expect.objectContaining({
          filePath: "/tmp/receipt-main.jpg",
          type: "RECEIPT",
        }),
      );
    });

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-upload"));
    await waitFor(() => {
      expect(mockSaveFromPicker).toHaveBeenCalledTimes(1);
      expect(mockAddAttachmentToDraft).toHaveBeenCalledWith(
        "draft-1",
        expect.objectContaining({
          filePath: "/tmp/receipt-upload.pdf",
          type: "RECEIPT",
        }),
      );
    });

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-addextraphto"));
    await waitFor(() => {
      expect(mockSaveFromCamera).toHaveBeenCalledTimes(2);
      expect(mockAddAttachmentToDraft).toHaveBeenCalledWith(
        "draft-1",
        expect.objectContaining({
          filePath: "/tmp/extra-photo.jpg",
          type: "PHOTO",
        }),
      );
    });

    await openAttachmentActions();
    fireEvent.press(screen.getByTestId("additem-btn-attachment-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("additem-btn-takephoto")).toBeNull();
    });
    expect(mockSaveFromCamera).toHaveBeenCalledTimes(2);
    expect(mockSaveFromPicker).toHaveBeenCalledTimes(1);
  });
});
