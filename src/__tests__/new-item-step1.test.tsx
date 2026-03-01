import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

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
const mockDraftAttachments: Array<{
  filePath: string;
  mimeType: string;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  type: "RECEIPT" | "PHOTO";
}> = [];

jest.mock("@/constants/theme", () => ({
  Spacing: {
    one: 4,
    two: 8,
    three: 16,
    four: 24,
  },
}));

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

jest.mock("@gluestack-ui/themed", () => {
  const {
    ActivityIndicator: MockActivityIndicator,
    Pressable: MockPressable,
    Text: MockText,
    TouchableOpacity: MockTouchableOpacity,
    View: MockView,
  } = require("react-native");

  const Block = ({ children, ...props }: any) => <MockView {...props}>{children}</MockView>;

  return {
    Badge: Block,
    BadgeText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Box: Block,
    Button: ({ children, ...props }: any) => <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>,
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Card: Block,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    HStack: Block,
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
    Pressable: ({ children, ...props }: any) => <MockPressable {...props}>{children}</MockPressable>,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({
    draftId: "draft-1",
    step: "1",
  }),
}));

jest.mock("@/components/ui", () => {
  const { Text: MockText, TextInput: MockTextInput, TouchableOpacity, View } = require("react-native");

  return {
    Badge: ({ text }: { text: string }) => <MockText>{text}</MockText>,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress}>
        <MockText>{label}</MockText>
      </TouchableOpacity>
    ),
    Card: ({ children }: any) => <View>{children}</View>,
    DatePickerTrigger: ({ value }: { value: string }) => <MockText>{value}</MockText>,
    FormField: ({ label, children }: any) => (
      <View>
        <MockText>{label}</MockText>
        {children}
      </View>
    ),
    Input: (props: any) => <MockTextInput {...props} />,
    Select: ({ value }: { value: string | null }) => <MockText>{value ?? "none"}</MockText>,
    TextArea: (props: any) => <MockTextInput {...props} />,
  };
});

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

describe("NewItemRoute step 1", () => {
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
    mockAddAttachmentToDraft.mockImplementation((draftId: string, attachment: any) => {
      mockDraftAttachments.push(attachment);
    });
    mockGetItemDraftAttachments.mockImplementation(() => [...mockDraftAttachments]);
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

    expect(await screen.findByText("Add Item: Attachments")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-item-step1-take-photo"));

    await waitFor(() => {
      expect(mockAddAttachmentToDraft).toHaveBeenCalled();
      expect(screen.getByText("receipt-a.jpg")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("new-item-step1-cancel"));

    await waitFor(() => {
      expect(mockClearItemDraft).toHaveBeenCalledWith("draft-1");
      expect(mockDeleteLocalAttachmentFile).toHaveBeenCalledWith("/tmp/receipt-a.jpg");
      expect(mockCreateItem).not.toHaveBeenCalled();
      expect(mockRouterReplace).toHaveBeenCalledWith("/(tabs)/items");
    });
  });
});
