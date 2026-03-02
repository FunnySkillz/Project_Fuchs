import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ItemEditRoute from "@/app/item/[id]/edit";

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
let mockRouterCanGoBack = false;
const mockNavigationGoBack = jest.fn();
let mockNavigationCanGoBack = true;

const mockNavigationAddListener = jest.fn();
const mockNavigationDispatch = jest.fn();
let beforeRemoveHandler: ((event: any) => void) | null = null;

const mockGetById = jest.fn();
const mockUpdateItem = jest.fn();
const mockListAttachments = jest.fn();
const mockAddAttachment = jest.fn();
const mockListCategories = jest.fn();
const mockCreateCustomCategory = jest.fn();

const mockAttachmentExists = jest.fn();
const mockResolveAttachmentPreviewUri = jest.fn();
const mockSaveFromCamera = jest.fn();
const mockSaveFromPicker = jest.fn();
const mockDeleteLocalAttachmentFile = jest.fn();
const mockDeleteAttachment = jest.fn();

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
    Spinner: (props: any) => <MockActivityIndicator {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Textarea: Block,
    TextareaInput: (props: any) => <MockTextInput {...props} />,
    VStack: Block,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    back: mockRouterBack,
    canGoBack: () => mockRouterCanGoBack,
  }),
  useLocalSearchParams: () => ({
    id: "item-1",
  }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    addListener: mockNavigationAddListener,
    canGoBack: () => mockNavigationCanGoBack,
    goBack: mockNavigationGoBack,
    dispatch: mockNavigationDispatch,
  }),
}));

jest.mock("@/repositories/create-core-repositories", () => ({
  getItemRepository: async () => ({
    getById: (id: string) => mockGetById(id),
    update: (input: unknown) => mockUpdateItem(input),
  }),
  getAttachmentRepository: async () => ({
    listByItem: (itemId: string) => mockListAttachments(itemId),
    add: (input: unknown) => mockAddAttachment(input),
  }),
  getCategoryRepository: async () => ({
    list: () => mockListCategories(),
    createCustomCategory: (input: { name: string }) => mockCreateCustomCategory(input),
  }),
}));

jest.mock("@/services/attachment-storage", () => ({
  attachmentFileExists: (filePath: string) => mockAttachmentExists(filePath),
  resolveAttachmentPreviewUri: (filePath: string, mimeType: string) =>
    mockResolveAttachmentPreviewUri(filePath, mimeType),
  saveFromCamera: () => mockSaveFromCamera(),
  saveFromPicker: () => mockSaveFromPicker(),
  deleteLocalAttachmentFile: (filePath: string) => mockDeleteLocalAttachmentFile(filePath),
}));

jest.mock("@/services/attachment-service", () => ({
  deleteAttachment: (id: string) => mockDeleteAttachment(id),
}));

describe("ItemEditRoute", () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockRouterBack.mockReset();
    mockRouterCanGoBack = false;
    mockNavigationGoBack.mockReset();
    mockNavigationCanGoBack = true;

    mockNavigationAddListener.mockReset();
    mockNavigationDispatch.mockReset();
    beforeRemoveHandler = null;

    mockGetById.mockReset();
    mockUpdateItem.mockReset();
    mockListAttachments.mockReset();
    mockAddAttachment.mockReset();
    mockListCategories.mockReset();
    mockCreateCustomCategory.mockReset();

    mockAttachmentExists.mockReset();
    mockResolveAttachmentPreviewUri.mockReset();
    mockSaveFromCamera.mockReset();
    mockSaveFromPicker.mockReset();
    mockDeleteLocalAttachmentFile.mockReset();
    mockDeleteAttachment.mockReset();

    mockNavigationAddListener.mockImplementation((eventName: string, handler: (event: any) => void) => {
      if (eventName === "beforeRemove") {
        beforeRemoveHandler = handler;
      }
      return jest.fn();
    });

    mockGetById.mockResolvedValue({
      id: "item-1",
      title: "Work laptop",
      purchaseDate: "2026-02-10",
      totalCents: 200_000,
      currency: "EUR",
      usageType: "WORK",
      workPercent: null,
      categoryId: "cat-1",
      vendor: "Old Vendor",
      warrantyMonths: 24,
      notes: "Invoice kept",
      usefulLifeMonthsOverride: 36,
      createdAt: "2026-02-11T09:00:00.000Z",
      updatedAt: "2026-02-11T09:00:00.000Z",
      deletedAt: null,
    });
    mockUpdateItem.mockImplementation(async (input: any) => ({
      id: input.id,
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
      createdAt: "2026-02-11T09:00:00.000Z",
      updatedAt: "2026-02-12T09:00:00.000Z",
      deletedAt: null,
    }));
    mockListAttachments.mockResolvedValue([]);
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
    mockCreateCustomCategory.mockResolvedValue({
      id: "cat-custom-1",
      name: "Custom",
    });
    mockAttachmentExists.mockResolvedValue(true);
    mockResolveAttachmentPreviewUri.mockImplementation(async (filePath: string) => filePath);
    mockSaveFromCamera.mockResolvedValue(null);
    mockSaveFromPicker.mockResolvedValue(null);
    mockDeleteAttachment.mockResolvedValue(undefined);
  });

  it("saves vendor and useful-life override updates", async () => {
    render(<ItemEditRoute />);

    expect(await screen.findByText("Edit Item")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("item-edit-vendor-input"), "New Vendor");
    fireEvent.changeText(screen.getByTestId("item-edit-useful-life-input"), "48");

    fireEvent.press(screen.getByTestId("item-edit-save"));

    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "item-1",
          vendor: "New Vendor",
          usefulLifeMonthsOverride: 48,
        })
      );
      expect(mockRouterReplace).toHaveBeenCalledWith("/item/item-1");
    });
  });

  it("shows discard confirmation on cancel when form is dirty", async () => {
    render(<ItemEditRoute />);

    expect(await screen.findByText("Edit Item")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("item-edit-title-input"), "Updated title");
    fireEvent.press(screen.getByTestId("edititem-cancel"));

    expect(screen.getByTestId("discard-modal")).toBeTruthy();
    fireEvent.press(screen.getByTestId("discard-confirm"));

    await waitFor(() => {
      expect(mockNavigationGoBack).toHaveBeenCalledTimes(1);
      expect(mockRouterReplace).not.toHaveBeenCalledWith("/item/item-1");
    });
  });

  it("exits safely on cancel when form is clean", async () => {
    render(<ItemEditRoute />);

    expect(await screen.findByText("Edit Item")).toBeTruthy();
    fireEvent.press(screen.getByTestId("edititem-cancel"));

    await waitFor(() => {
      expect(mockNavigationGoBack).toHaveBeenCalledTimes(1);
      expect(mockRouterReplace).not.toHaveBeenCalledWith("/item/item-1");
      expect(mockRouterBack).not.toHaveBeenCalled();
    });
  });

  it("keeps edits when discard modal is dismissed with keep editing", async () => {
    render(<ItemEditRoute />);

    expect(await screen.findByText("Edit Item")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("item-edit-title-input"), "Updated title");
    fireEvent.press(screen.getByTestId("edititem-cancel"));

    expect(screen.getByTestId("discard-modal")).toBeTruthy();
    fireEvent.press(screen.getByTestId("keep-editing"));

    expect(screen.queryByTestId("discard-modal")).toBeNull();
    expect(screen.getByDisplayValue("Updated title")).toBeTruthy();
    expect(mockNavigationGoBack).not.toHaveBeenCalled();
  });

  it("intercepts navigation back and exits safely after discard", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<ItemEditRoute />);

    expect(await screen.findByText("Edit Item")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("item-edit-title-input"), "Updated title");

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
    expect(screen.getByTestId("discard-modal")).toBeTruthy();

    fireEvent.press(screen.getByTestId("discard-confirm"));

    await waitFor(() => {
      expect(mockNavigationGoBack).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
    consoleErrorSpy.mockRestore();
  });

  it("allows clean navigation back without showing discard modal", async () => {
    render(<ItemEditRoute />);

    expect(await screen.findByText("Edit Item")).toBeTruthy();
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
    expect(screen.queryByTestId("discard-modal")).toBeNull();
    expect(mockNavigationGoBack).not.toHaveBeenCalled();
  });
});
