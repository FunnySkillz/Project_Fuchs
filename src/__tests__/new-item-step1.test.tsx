import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import NewItemRoute from "@/app/item/new";

const mockRouterReplace = jest.fn();
const mockRouter = { replace: mockRouterReplace };
const mockGetCategoryRepository = jest.fn();
const mockCreateItem = jest.fn();
const mockSaveFromCamera = jest.fn();
const mockSaveFromPicker = jest.fn();
const mockDeleteLocalAttachmentFile = jest.fn();
const mockClearItemDraft = jest.fn();
const mockAddAttachmentToDraft = jest.fn();
const mockGetItemDraftAttachments = jest.fn();
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
    Slider: Block,
    SliderFilledTrack: Block,
    SliderThumb: Block,
    SliderTrack: Block,
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

describe("NewItemRoute attachments and cancel behavior", () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockGetCategoryRepository.mockReset();
    mockCreateItem.mockReset();
    mockSaveFromCamera.mockReset();
    mockSaveFromPicker.mockReset();
    mockDeleteLocalAttachmentFile.mockReset();
    mockClearItemDraft.mockReset();
    mockAddAttachmentToDraft.mockReset();
    mockGetItemDraftAttachments.mockReset();
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

    expect(await screen.findByText("1) Attachments")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-item-attachment-take-photo"));

    await waitFor(() => {
      expect(mockAddAttachmentToDraft).toHaveBeenCalled();
      expect(screen.getByText("receipt-a.jpg")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("new-item-cancel"));

    await waitFor(() => {
      expect(mockClearItemDraft).toHaveBeenCalledWith("draft-1");
      expect(mockDeleteLocalAttachmentFile).toHaveBeenCalledWith("/tmp/receipt-a.jpg");
      expect(mockCreateItem).not.toHaveBeenCalled();
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
    expect(await screen.findByText("1) Attachments")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-item-attachment-upload"));
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
    expect(await screen.findByText("1) Attachments")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-item-attachment-take-photo"));

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
    expect(await screen.findByText("1) Attachments")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-item-attachment-upload"));

    await waitFor(() => {
      expect(mockAddAttachmentToDraft).not.toHaveBeenCalled();
      expect(screen.queryByText("Action canceled.")).toBeNull();
    });
  });
});
