import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ExportRoute from "@/app/(tabs)/export";

const mockListItems = jest.fn();
const mockListMissingReceiptItemIds = jest.fn();
const mockListCategories = jest.fn();
const mockListExportRuns = jest.fn();
const mockCreateExportRun = jest.fn();
const mockGetSettings = jest.fn();
const mockComputeDeductibleImpactCents = jest.fn();
const mockGetExportSelectionSessionState = jest.fn();
const mockUpdateExportSelectionSessionState = jest.fn();
const mockGeneratePdfExport = jest.fn();
const mockShareExportPdf = jest.fn();
const mockGenerateZipExport = jest.fn();
const mockShareExportZip = jest.fn();
const mockGetSavedExportDirectoryUri = jest.fn();
const mockPickAndPersistExportDirectory = jest.fn();
const mockClearSavedExportDirectoryUri = jest.fn();
const mockSaveExportCopyToDirectory = jest.fn();
const mockIsExportDirectoryPickerSupported = jest.fn();
const mockGetLocalExportDirectoryUri = jest.fn();
const mockFormatDirectoryUriForDisplay = jest.fn();

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
    Switch: (props: any) => <MockSwitch {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
    Pressable: ({ children, ...props }: any) => <MockPressable {...props}>{children}</MockPressable>,
  };
});

jest.mock("expo-router", () => {
  const ReactModule = require("react");
  return {
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

jest.mock("@/repositories/create-core-repositories", () => ({
  getItemRepository: async () => ({
    list: mockListItems,
    listMissingReceiptItemIds: mockListMissingReceiptItemIds,
  }),
  getCategoryRepository: async () => ({
    list: mockListCategories,
  }),
  getExportRunRepository: async () => ({
    listByYear: mockListExportRuns,
    create: mockCreateExportRun,
  }),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    getSettings: mockGetSettings,
  }),
}));

jest.mock("@/services/export-selection-session", () => ({
  getExportSelectionSessionState: () => mockGetExportSelectionSessionState(),
  updateExportSelectionSessionState: (partial: unknown) => mockUpdateExportSelectionSessionState(partial),
}));

jest.mock("@/services/pdf-export", () => ({
  generatePdfExport: (input: unknown) => mockGeneratePdfExport(input),
  shareExportPdf: (fileUri: string) => mockShareExportPdf(fileUri),
}));

jest.mock("@/services/zip-export", () => ({
  generateZipExport: (input: unknown) => mockGenerateZipExport(input),
  shareExportZip: (fileUri: string) => mockShareExportZip(fileUri),
}));

jest.mock("@/services/export-destination", () => ({
  getSavedExportDirectoryUri: () => mockGetSavedExportDirectoryUri(),
  pickAndPersistExportDirectory: (initialDirectoryUri?: string | null) =>
    mockPickAndPersistExportDirectory(initialDirectoryUri),
  clearSavedExportDirectoryUri: () => mockClearSavedExportDirectoryUri(),
  saveExportCopyToDirectory: (input: unknown) => mockSaveExportCopyToDirectory(input),
  isExportDirectoryPickerSupported: () => mockIsExportDirectoryPickerSupported(),
  getLocalExportDirectoryUri: () => mockGetLocalExportDirectoryUri(),
  formatDirectoryUriForDisplay: (uri: string) => mockFormatDirectoryUriForDisplay(uri),
}));

describe("ExportRoute", () => {
  beforeEach(() => {
    mockListItems.mockReset();
    mockListMissingReceiptItemIds.mockReset();
    mockListCategories.mockReset();
    mockListExportRuns.mockReset();
    mockCreateExportRun.mockReset();
    mockGetSettings.mockReset();
    mockComputeDeductibleImpactCents.mockReset();
    mockGetExportSelectionSessionState.mockReset();
    mockUpdateExportSelectionSessionState.mockReset();
    mockGeneratePdfExport.mockReset();
    mockShareExportPdf.mockReset();
    mockGenerateZipExport.mockReset();
    mockShareExportZip.mockReset();
    mockGetSavedExportDirectoryUri.mockReset();
    mockPickAndPersistExportDirectory.mockReset();
    mockClearSavedExportDirectoryUri.mockReset();
    mockSaveExportCopyToDirectory.mockReset();
    mockIsExportDirectoryPickerSupported.mockReset();
    mockGetLocalExportDirectoryUri.mockReset();
    mockFormatDirectoryUriForDisplay.mockReset();

    mockGetExportSelectionSessionState.mockReturnValue({
      taxYear: "",
      search: "",
      categoryId: null,
      usageType: null,
      missingReceipt: false,
      missingNotes: false,
      selectedItemIds: [],
    });

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

    mockListItems.mockResolvedValue([
      {
        id: "item-1",
        title: "Work laptop",
        purchaseDate: "2026-02-01",
        totalCents: 199_900,
        currency: "EUR",
        usageType: "WORK",
        workPercent: null,
        categoryId: "cat-1",
        vendor: "Tech Store",
        warrantyMonths: 24,
        notes: null,
        usefulLifeMonthsOverride: null,
        createdAt: "2026-02-01T10:00:00.000Z",
        updatedAt: "2026-02-01T10:00:00.000Z",
        deletedAt: null,
      },
    ]);
    mockListMissingReceiptItemIds.mockResolvedValue(["item-1"]);
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
    mockListExportRuns.mockResolvedValue([]);
    mockCreateExportRun.mockImplementation(async (input: any) => ({
      id: `run-${String(input.outputType).toLowerCase()}`,
      taxYear: input.taxYear,
      itemCount: input.itemCount,
      totalDeductibleCents: input.totalDeductibleCents,
      estimatedRefundCents: input.estimatedRefundCents,
      outputType: input.outputType,
      outputFilePath: input.outputFilePath,
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-01T10:00:00.000Z",
      deletedAt: null,
    }));
    mockComputeDeductibleImpactCents.mockReturnValue(90_000);
    mockGeneratePdfExport.mockResolvedValue({
      fileUri: "file:///exports/export-2026.pdf",
      fileName: "export-2026.pdf",
    });
    mockGenerateZipExport.mockImplementation(async (input: any) => {
      input.onProgress?.({ percent: 60, message: "Building archive" });
      return {
        fileUri: "file:///exports/export-2026.zip",
        fileName: "export-2026.zip",
        sizeBytes: 1_048_576,
      };
    });
    mockShareExportPdf.mockResolvedValue(undefined);
    mockShareExportZip.mockResolvedValue(undefined);
    mockGetSavedExportDirectoryUri.mockResolvedValue(null);
    mockPickAndPersistExportDirectory.mockResolvedValue({
      granted: true,
      directoryUri: "content://tree/primary%3ADownload%2FSteuerFuchs",
    });
    mockClearSavedExportDirectoryUri.mockResolvedValue(undefined);
    mockSaveExportCopyToDirectory.mockResolvedValue({
      directoryUri: "content://tree/primary%3ADownload%2FSteuerFuchs",
      fileUri: "content://document/primary%3ADownload%2FSteuerFuchs%2Fexport-2026.pdf",
    });
    mockIsExportDirectoryPickerSupported.mockReturnValue(false);
    mockGetLocalExportDirectoryUri.mockReturnValue("file:///app/exports");
    mockFormatDirectoryUriForDisplay.mockImplementation((uri: string) => uri);
  });

  it("uses a staged flow and generates selected format with one primary action", async () => {
    render(<ExportRoute />);

    expect(await screen.findByText("Export")).toBeTruthy();
    expect(screen.getByText("Select items")).toBeTruthy();
    expect(screen.getByText("Totals summary")).toBeTruthy();
    expect(screen.getByText("Export history")).toBeTruthy();
    expect(screen.getByText("Selected items: 0")).toBeTruthy();
    expect(screen.queryByText("Work laptop")).toBeNull();

    fireEvent.press(screen.getByTestId("export-selection-toggle"));
    expect(await screen.findByText("Work laptop")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-row-toggle-item-1"));
    expect(screen.getByText("Selected items: 1")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-generate"));
    await waitFor(() => {
      expect(mockGeneratePdfExport).toHaveBeenCalledWith(
        expect.objectContaining({
          taxYear: 2026,
          includeDetailPages: false,
        })
      );
      expect(mockCreateExportRun).toHaveBeenCalledWith(
        expect.objectContaining({
          outputType: "PDF",
          itemCount: 1,
        })
      );
    });

    fireEvent.press(screen.getByTestId("export-format-zip"));
    fireEvent.press(screen.getByTestId("export-generate"));
    await waitFor(() => {
      expect(mockGenerateZipExport).toHaveBeenCalledWith(
        expect.objectContaining({
          taxYear: 2026,
          includeDetailPages: false,
        })
      );
      expect(mockCreateExportRun).toHaveBeenCalledWith(
        expect.objectContaining({
          outputType: "ZIP",
          itemCount: 1,
        })
      );
    });

    expect(screen.getByText("ZIP progress: 60% - Building archive")).toBeTruthy();
    expect(screen.getByText("Last export: export-2026.zip")).toBeTruthy();
    expect(screen.getByText("2 run(s) in selected tax year")).toBeTruthy();
  });

  it("can share the latest generated export without opening history", async () => {
    render(<ExportRoute />);
    expect(await screen.findByText("Export")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-selection-toggle"));
    fireEvent.press(screen.getByTestId("export-row-toggle-item-1"));
    fireEvent.press(screen.getByTestId("export-generate"));

    await waitFor(() => {
      expect(screen.getByText("Last export: export-2026.pdf")).toBeTruthy();
      expect(screen.getByTestId("export-last-local-file-uri")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("export-share-latest"));

    await waitFor(() => {
      expect(mockShareExportPdf).toHaveBeenCalledWith("file:///exports/export-2026.pdf");
    });
  });

  it("copies exports into the selected Android folder", async () => {
    mockIsExportDirectoryPickerSupported.mockReturnValue(true);
    mockGetSavedExportDirectoryUri.mockResolvedValue(
      "content://com.android.externalstorage.documents/tree/primary%3ADownload%2FSteuerFuchs"
    );
    mockFormatDirectoryUriForDisplay.mockReturnValue("Internal storage/Download/SteuerFuchs");

    render(<ExportRoute />);
    expect(await screen.findByText("Export")).toBeTruthy();
    expect(await screen.findByText("Selected folder: Internal storage/Download/SteuerFuchs")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-selection-toggle"));
    fireEvent.press(screen.getByTestId("export-row-toggle-item-1"));
    fireEvent.press(screen.getByTestId("export-generate"));

    await waitFor(() => {
      expect(mockSaveExportCopyToDirectory).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceFileUri: "file:///exports/export-2026.pdf",
          sourceFileName: "export-2026.pdf",
          mimeType: "application/pdf",
        })
      );
      expect(screen.getByTestId("export-last-folder-file-uri")).toBeTruthy();
    });
  });

  it("shows empty-state copy when no items match once selection is expanded", async () => {
    mockListItems.mockResolvedValue([]);
    mockListMissingReceiptItemIds.mockResolvedValue([]);

    render(<ExportRoute />);
    expect(await screen.findByText("Export")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-selection-toggle"));
    expect(await screen.findByText("No items found. Adjust filters or add a new item.")).toBeTruthy();
  });

  it("shows error state and retries loading", async () => {
    mockListItems.mockRejectedValueOnce(new Error("DB offline"));
    mockListItems.mockResolvedValueOnce([]);
    mockListMissingReceiptItemIds.mockResolvedValue([]);

    render(<ExportRoute />);

    expect(await screen.findByText("Could not load export selection data.")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-retry"));

    await waitFor(() => {
      expect(mockListItems).toHaveBeenCalledTimes(2);
    });
  });

  it("does not create export history when PDF generation fails", async () => {
    mockGeneratePdfExport.mockRejectedValueOnce(new Error("PDF engine failed"));

    render(<ExportRoute />);
    expect(await screen.findByText("Export")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-selection-toggle"));
    fireEvent.press(screen.getByTestId("export-row-toggle-item-1"));
    fireEvent.press(screen.getByTestId("export-generate"));

    expect(await screen.findByText("Could not generate PDF export.")).toBeTruthy();
    expect(mockCreateExportRun).not.toHaveBeenCalled();
  });

  it("does not create export history when ZIP generation fails", async () => {
    mockGenerateZipExport.mockRejectedValueOnce(new Error("ZIP creation failed"));

    render(<ExportRoute />);
    expect(await screen.findByText("Export")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-selection-toggle"));
    fireEvent.press(screen.getByTestId("export-row-toggle-item-1"));
    fireEvent.press(screen.getByTestId("export-format-zip"));
    fireEvent.press(screen.getByTestId("export-generate"));

    expect(await screen.findByText("Could not generate ZIP export.")).toBeTruthy();
    expect(mockCreateExportRun).not.toHaveBeenCalled();
  });

  it("shows validation feedback when tax year is invalid and blocks generation", async () => {
    render(<ExportRoute />);
    expect(await screen.findByText("Export")).toBeTruthy();

    fireEvent.press(screen.getByTestId("export-selection-toggle"));
    fireEvent.press(screen.getByTestId("export-row-toggle-item-1"));
    fireEvent.changeText(screen.getByTestId("export-tax-year-input"), "20ab");

    fireEvent.press(screen.getByTestId("export-generate"));

    await waitFor(() => {
      expect(screen.getByTestId("export-error-taxYear")).toBeTruthy();
    });

    expect(mockGeneratePdfExport).not.toHaveBeenCalled();
    expect(mockGenerateZipExport).not.toHaveBeenCalled();
    expect(screen.getByTestId("export-generate").props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId("export-tax-year-input"), "2026");
    await waitFor(() => {
      expect(screen.queryByTestId("export-error-taxYear")).toBeNull();
      expect(screen.getByTestId("export-generate").props.accessibilityState?.disabled).toBe(false);
    });
  });
});
