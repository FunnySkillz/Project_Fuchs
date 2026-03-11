import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonText,
  Card,
  Heading,
  HStack,
  Input,
  InputField,
  Spinner,
  Switch,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import type { Category } from "@/models/category";
import type { ExportRun } from "@/models/export-run";
import type { Item, ItemUsageType } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import {
  getCategoryRepository,
  getExportRunRepository,
  getItemRepository,
} from "@/repositories/create-core-repositories";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import {
  clearSavedExportDirectoryUri,
  formatDirectoryUriForDisplay,
  getLocalExportDirectoryUri,
  getSavedExportDirectoryUri,
  isExportDirectoryPickerSupported,
  pickAndPersistExportDirectory,
  saveExportCopyToDirectory,
} from "@/services/export-destination";
import {
  getExportSelectionSessionState,
  updateExportSelectionSessionState,
} from "@/services/export-selection-session";
import { friendlyFileErrorMessage } from "@/services/friendly-errors";
import { generatePdfExport, shareExportPdf } from "@/services/pdf-export";
import { formatCents } from "@/utils/money";
import {
  generateZipExport,
  shareExportZip,
  type ZipExportProgress,
} from "@/services/zip-export";
import { useTheme } from "@/hooks/use-theme";

type FilterSheetKind = "usageType" | "category" | null;
type ExportFormat = "PDF" | "ZIP";
type ExportFieldKey = "taxYear";
type FocusTarget = { focus?: () => void };

const usageOptions: { label: string; value: ItemUsageType | null }[] = [
  { label: "All usage types", value: null },
  { label: "WORK", value: "WORK" },
  { label: "PRIVATE", value: "PRIVATE" },
  { label: "MIXED", value: "MIXED" },
  { label: "OTHER", value: "OTHER" },
];

function parseYearInput(rawYear: string): number | undefined {
  const trimmed = rawYear.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getTaxYearValidationMessage(rawYear: string): string | null {
  const trimmed = rawYear.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return "Tax year must be a 4-digit year.";
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2100) {
    return "Tax year must be between 1900 and 2100.";
  }
  return null;
}

function missingNotesForItem(item: Item): boolean {
  return (item.usageType === "WORK" || item.usageType === "MIXED") && !item.notes?.trim();
}

interface ExportItemRowProps {
  item: Item;
  categoryName: string;
  deductibleThisYearCents: number;
  selected: boolean;
  missingReceipt: boolean;
  missingNotes: boolean;
  onToggle: (itemId: string) => void;
}

const ExportItemRow = React.memo(function ExportItemRow({
  item,
  categoryName,
  deductibleThisYearCents,
  selected,
  missingReceipt,
  missingNotes,
  onToggle,
}: ExportItemRowProps) {
  const theme = useTheme();

  return (
    <Card borderWidth="$1" borderColor="$border200" mb="$3">
      <VStack space="sm">
        <HStack justifyContent="space-between" alignItems="flex-start" space="md">
          <VStack space="xs" flex={1}>
            <Text bold size="md" color={theme.text}>
              {item.title}
            </Text>
            <Text size="sm" color={theme.textSecondary}>
              {categoryName} | {item.purchaseDate}
            </Text>
            <Text size="sm" color={theme.textSecondary}>
              Deductible this year: {formatCents(deductibleThisYearCents)}
            </Text>
          </VStack>
          <Text bold size="md" color={theme.text}>
            {formatCents(item.totalCents)}
          </Text>
        </HStack>

        <HStack space="sm" flexWrap="wrap">
          {missingReceipt && (
            <Badge size="sm" action="warning" variant="outline">
              <BadgeText>Missing receipt</BadgeText>
            </Badge>
          )}
          {missingNotes && (
            <Badge size="sm" action="warning" variant="outline">
              <BadgeText>Missing notes</BadgeText>
            </Badge>
          )}
          <Badge size="sm" action={selected ? "success" : "muted"} variant="outline">
            <BadgeText>{selected ? "Selected" : "Not selected"}</BadgeText>
          </Badge>
        </HStack>

        <HStack justifyContent="flex-end">
          <Button
            size="sm"
            variant={selected ? "outline" : "solid"}
            action={selected ? "secondary" : "primary"}
            onPress={() => onToggle(item.id)}
            testID={`export-row-toggle-${item.id}`}
          >
            <ButtonText>{selected ? "Unselect" : "Select"}</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
});

export default function ExportRoute() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const sessionDefaults = useMemo(() => getExportSelectionSessionState(), []);
  const fieldYRef = useRef<Partial<Record<ExportFieldKey, number>>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const inputRef = useRef<Partial<Record<ExportFieldKey, FocusTarget | null>>>({});

  const [taxYear, setTaxYear] = useState(sessionDefaults.taxYear);
  const [search, setSearch] = useState(sessionDefaults.search);
  const [categoryId, setCategoryId] = useState<string | null>(sessionDefaults.categoryId);
  const [usageType, setUsageType] = useState<ItemUsageType | null>(sessionDefaults.usageType);
  const [missingReceipt, setMissingReceipt] = useState(sessionDefaults.missingReceipt);
  const [missingNotes, setMissingNotes] = useState(sessionDefaults.missingNotes);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(sessionDefaults.selectedItemIds)
  );
  const [includeDetailPages, setIncludeDetailPages] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("PDF");
  const [isGenerating, setIsGenerating] = useState(false);
  const [latestGeneratedFileName, setLatestGeneratedFileName] = useState<string | null>(null);
  const [latestGeneratedFileUri, setLatestGeneratedFileUri] = useState<string | null>(null);
  const [latestGeneratedFormat, setLatestGeneratedFormat] = useState<ExportFormat | null>(null);
  const [savedDirectoryUri, setSavedDirectoryUri] = useState<string | null>(null);
  const [latestSavedDirectoryFileUri, setLatestSavedDirectoryFileUri] = useState<string | null>(
    null
  );
  const [directorySaveError, setDirectorySaveError] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipExportProgress | null>(null);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<FilterSheetKind>(null);

  const [yearItems, setYearItems] = useState<Item[]>([]);
  const [missingReceiptItemIds, setMissingReceiptItemIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ExportFieldKey, boolean>>>({});

  const parsedTaxYear = useMemo(() => parseYearInput(taxYear), [taxYear]);
  const taxYearError = useMemo(() => getTaxYearValidationMessage(taxYear), [taxYear]);
  const isGenerateFormValid = taxYearError === null;
  const shouldShowTaxYearError = Boolean((submitAttempted || touchedFields.taxYear) && taxYearError);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const usageChipLabel = usageType ? `Usage: ${usageType}` : "Usage: all";
  const categoryChipLabel = categoryId
    ? `Category: ${categoryMap.get(categoryId)?.name ?? "Unknown"}`
    : "Category: all";
  const supportsDirectoryPicker = useMemo(() => isExportDirectoryPickerSupported(), []);
  const localExportDirectoryUri = useMemo(() => {
    try {
      return getLocalExportDirectoryUri();
    } catch {
      return "Unavailable";
    }
  }, []);
  const savedDirectoryLabel = savedDirectoryUri
    ? formatDirectoryUriForDisplay(savedDirectoryUri)
    : "Not selected";

  useEffect(() => {
    updateExportSelectionSessionState({
      taxYear,
      search,
      categoryId,
      usageType,
      missingReceipt,
      missingNotes,
      selectedItemIds: Array.from(selectedItemIds),
    });
  }, [categoryId, missingNotes, missingReceipt, search, selectedItemIds, taxYear, usageType]);

  useEffect(() => {
    if (!supportsDirectoryPicker) {
      return;
    }
    let active = true;
    const loadSavedDirectory = async () => {
      try {
        const savedUri = await getSavedExportDirectoryUri();
        if (active) {
          setSavedDirectoryUri(savedUri);
        }
      } catch (error) {
        console.error("Failed to load saved export directory", error);
      }
    };
    void loadSavedDirectory();
    return () => {
      active = false;
    };
  }, [supportsDirectoryPicker]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [itemRepository, categoryRepository, profileSettingsRepository, exportRunRepository] =
        await Promise.all([
          getItemRepository(),
          getCategoryRepository(),
          getProfileSettingsRepository(),
          getExportRunRepository(),
        ]);

      const loadedSettings = await profileSettingsRepository.getSettings();
      const targetYear = parsedTaxYear ?? loadedSettings.taxYearDefault;

      const [loadedItems, loadedCategories, loadedMissingReceiptIds, loadedHistory] =
        await Promise.all([
          itemRepository.list({ year: targetYear }),
          categoryRepository.list(),
          itemRepository.listMissingReceiptItemIds({ year: targetYear }),
          exportRunRepository.listByYear(targetYear),
        ]);

      setYearItems(loadedItems);
      setMissingReceiptItemIds(new Set(loadedMissingReceiptIds));
      setCategories(loadedCategories);
      setSettings(loadedSettings);
      setExportHistory(loadedHistory);

      const validYearItemIds = new Set(loadedItems.map((item) => item.id));
      setSelectedItemIds((current) => {
        const next = new Set<string>();
        current.forEach((id) => {
          if (validYearItemIds.has(id)) {
            next.add(id);
          }
        });
        return next;
      });
    } catch (error) {
      console.error("Failed to load export selection data", error);
      setYearItems([]);
      setMissingReceiptItemIds(new Set());
      setExportHistory([]);
      setLoadError("Could not load export selection data.");
    } finally {
      setIsLoading(false);
    }
  }, [parsedTaxYear]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return yearItems.filter((item) => {
      if (categoryId && item.categoryId !== categoryId) {
        return false;
      }
      if (usageType && item.usageType !== usageType) {
        return false;
      }
      if (missingReceipt && !missingReceiptItemIds.has(item.id)) {
        return false;
      }
      if (missingNotes && !missingNotesForItem(item)) {
        return false;
      }
      if (searchTerm.length === 0) {
        return true;
      }
      const haystack = `${item.title} ${item.vendor ?? ""}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [categoryId, missingNotes, missingReceipt, missingReceiptItemIds, search, usageType, yearItems]);

  const filteredItemIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems]);
  const allFilteredSelected =
    filteredItemIds.length > 0 && filteredItemIds.every((id) => selectedItemIds.has(id));

  const selectedItems = useMemo(
    () => yearItems.filter((item) => selectedItemIds.has(item.id)),
    [selectedItemIds, yearItems]
  );

  const targetYearForCalc = parsedTaxYear ?? settings?.taxYearDefault ?? new Date().getFullYear();
  const deductibleByItemId = useMemo(() => {
    if (!settings) {
      return new Map<string, number>();
    }
    return new Map(
      yearItems.map((item) => [
        item.id,
        computeDeductibleImpactCents(item, settings, categoryMap, targetYearForCalc),
      ])
    );
  }, [categoryMap, settings, targetYearForCalc, yearItems]);

  const totals = useMemo(() => {
    if (!settings) {
      return {
        deductibleThisYearCents: 0,
        estimatedRefundCents: 0,
      };
    }
    const deductibleThisYearCents = selectedItems.reduce((sum, item) => {
      return sum + (deductibleByItemId.get(item.id) ?? 0);
    }, 0);
    const estimatedRefundCents = Math.round(
      (deductibleThisYearCents * settings.marginalRateBps) / 10_000
    );

    return {
      deductibleThisYearCents,
      estimatedRefundCents,
    };
  }, [deductibleByItemId, selectedItems, settings]);
  const hasSelectedItems = selectedItems.length > 0;
  const isGenerateDisabled =
    !hasSelectedItems || isGenerating || (submitAttempted && !isGenerateFormValid);
  const generateButtonStyle = useMemo(
    () => ({
      backgroundColor: isGenerateDisabled ? theme.backgroundElement : theme.primary,
      borderColor: isGenerateDisabled ? theme.border : theme.primary,
      borderWidth: 1,
      opacity: isGenerateDisabled ? 0.72 : 1,
    }),
    [isGenerateDisabled, theme.backgroundElement, theme.border, theme.primary]
  );
  const generateButtonTextColor = isGenerateDisabled ? theme.textMuted : theme.textOnPrimary;

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredItemIds.forEach((id) => next.delete(id));
      } else {
        filteredItemIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryId(null);
    setUsageType(null);
    setMissingReceipt(false);
    setMissingNotes(false);
  };

  const scrollToField = useCallback((field: ExportFieldKey) => {
    const y = fieldYRef.current[field];
    if (typeof y !== "number") {
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
  }, []);

  const focusField = useCallback((field: ExportFieldKey) => {
    const target = inputRef.current[field];
    if (!target || typeof target.focus !== "function") {
      return;
    }
    requestAnimationFrame(() => {
      target.focus?.();
    });
  }, []);

  const focusFirstInvalidField = useCallback(() => {
    if (!taxYearError) {
      return;
    }
    scrollToField("taxYear");
    focusField("taxYear");
  }, [focusField, scrollToField, taxYearError]);

  const saveCopyToSelectedDirectory = useCallback(
    async (input: { fileUri: string; fileName: string; format: ExportFormat }) => {
      if (!supportsDirectoryPicker || !savedDirectoryUri) {
        setLatestSavedDirectoryFileUri(null);
        return;
      }

      try {
        const result = await saveExportCopyToDirectory({
          sourceFileUri: input.fileUri,
          sourceFileName: input.fileName,
          mimeType: input.format === "PDF" ? "application/pdf" : "application/zip",
          directoryUri: savedDirectoryUri,
        });
        setLatestSavedDirectoryFileUri(result.fileUri);
        setDirectorySaveError(null);
      } catch (error) {
        console.error("Failed to copy export into selected directory", error);
        setLatestSavedDirectoryFileUri(null);
        setDirectorySaveError(
          friendlyFileErrorMessage(
            error,
            "Export was created, but copying it to the selected folder failed."
          )
        );
      }
    },
    [savedDirectoryUri, supportsDirectoryPicker]
  );

  const handlePickExportDirectory = useCallback(async () => {
    if (!supportsDirectoryPicker) {
      return;
    }

    try {
      const result = await pickAndPersistExportDirectory(savedDirectoryUri);
      if (!result.granted || !result.directoryUri) {
        return;
      }
      setSavedDirectoryUri(result.directoryUri);
      setDirectorySaveError(null);
    } catch (error) {
      console.error("Failed to select export directory", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not choose export folder."));
    }
  }, [savedDirectoryUri, supportsDirectoryPicker]);

  const handleClearExportDirectory = useCallback(async () => {
    try {
      await clearSavedExportDirectoryUri();
      setSavedDirectoryUri(null);
      setLatestSavedDirectoryFileUri(null);
      setDirectorySaveError(null);
    } catch (error) {
      console.error("Failed to clear saved export directory", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not clear selected export folder."));
    }
  }, []);

  const handleShareLatestGeneratedExport = useCallback(async () => {
    if (!latestGeneratedFileUri || !latestGeneratedFormat) {
      return;
    }
    try {
      if (latestGeneratedFormat === "PDF") {
        await shareExportPdf(latestGeneratedFileUri);
      } else {
        await shareExportZip(latestGeneratedFileUri);
      }
    } catch (error) {
      console.error("Failed to share latest generated export", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not share latest export file."));
    }
  }, [latestGeneratedFileUri, latestGeneratedFormat]);

  const handleGenerateExport = async () => {
    setSubmitAttempted(true);
    if (!isGenerateFormValid || !settings || selectedItems.length === 0 || isGenerating) {
      if (!isGenerateFormValid) {
        focusFirstInvalidField();
      }
      return;
    }

    setIsGenerating(true);
    setZipProgress(null);
    setDirectorySaveError(null);
    setLoadError(null);
    try {
      if (selectedFormat === "PDF") {
        const result = await generatePdfExport({
          taxYear: targetYearForCalc,
          selectedItems,
          categories,
          settings,
          includeDetailPages,
        });
        setLatestGeneratedFileName(result.fileName);
        setLatestGeneratedFileUri(result.fileUri);
        setLatestGeneratedFormat("PDF");
        await saveCopyToSelectedDirectory({
          fileUri: result.fileUri,
          fileName: result.fileName,
          format: "PDF",
        });

        const exportRunRepository = await getExportRunRepository();
        const run = await exportRunRepository.create({
          taxYear: targetYearForCalc,
          itemCount: selectedItems.length,
          totalDeductibleCents: totals.deductibleThisYearCents,
          estimatedRefundCents: totals.estimatedRefundCents,
          outputType: "PDF",
          outputFilePath: result.fileUri,
        });
        setExportHistory((current) => [run, ...current]);
        return;
      }

      const result = await generateZipExport({
        taxYear: targetYearForCalc,
        selectedItems,
        categories,
        settings,
        includeDetailPages,
        onProgress: (progress) => setZipProgress(progress),
      });
      setLatestGeneratedFileName(result.fileName);
      setLatestGeneratedFileUri(result.fileUri);
      setLatestGeneratedFormat("ZIP");
      await saveCopyToSelectedDirectory({
        fileUri: result.fileUri,
        fileName: result.fileName,
        format: "ZIP",
      });

      const exportRunRepository = await getExportRunRepository();
      const run = await exportRunRepository.create({
        taxYear: targetYearForCalc,
        itemCount: selectedItems.length,
        totalDeductibleCents: totals.deductibleThisYearCents,
        estimatedRefundCents: totals.estimatedRefundCents,
        outputType: "ZIP",
        outputFilePath: result.fileUri,
      });
      setExportHistory((current) => [run, ...current]);
    } catch (error) {
      console.error("Failed to generate export", error);
      setLoadError(
        friendlyFileErrorMessage(
          error,
          selectedFormat === "PDF" ? "Could not generate PDF export." : "Could not generate ZIP export."
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareHistoryRun = async (run: ExportRun) => {
    if (!run.outputFilePath) {
      setLoadError("Selected export history entry has no output file path.");
      return;
    }
    try {
      if (run.outputType === "PDF") {
        await shareExportPdf(run.outputFilePath);
      } else {
        await shareExportZip(run.outputFilePath);
      }
    } catch (error) {
      console.error("Failed to share export from history", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not share export file from history."));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <Box flex={1} px="$5" py="$6">
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
            <VStack space="lg" maxWidth={900} width="$full" alignSelf="center">
              <VStack space="xs">
                <Heading size="2xl" color={theme.text}>
                  Export
                </Heading>
                <Text size="sm" color={theme.textSecondary}>
                  Select, review, then generate a clean export package.
                </Text>
              </VStack>

              <Card borderWidth="$1" borderColor="$border200">
                <VStack space="sm">
                  <Text bold size="sm" color={theme.text}>
                    Tax year
                  </Text>
                <Box
                  testID="export-input-taxYear"
                  onLayout={(event) => {
                    fieldYRef.current.taxYear = event.nativeEvent.layout.y;
                  }}
                >
                  <Input
                    variant="outline"
                    size="md"
                    borderColor={shouldShowTaxYearError ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.taxYear = node as FocusTarget | null;
                      }}
                      value={taxYear}
                      onChangeText={setTaxYear}
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder={settings ? String(settings.taxYearDefault) : "e.g. 2026"}
                      testID="export-tax-year-input"
                      accessibilityState={({ invalid: shouldShowTaxYearError } as any)}
                      onBlur={() => {
                        setTouchedFields((current) => ({ ...current, taxYear: true }));
                      }}
                    />
                  </Input>
                </Box>
                {shouldShowTaxYearError ? (
                  <Text
                    size="xs"
                    color={theme.danger}
                    testID="export-error-taxYear"
                    accessibilityLiveRegion="polite"
                  >
                    {taxYearError}
                  </Text>
                ) : null}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <HStack justifyContent="space-between" alignItems="center" space="sm">
                  <VStack space="xs" flex={1}>
                    <Heading size="md" color={theme.text}>
                      Select items
                    </Heading>
                    <Text size="sm" color={theme.textSecondary}>
                      Selected items: {selectedItems.length}
                    </Text>
                  </VStack>
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={() => setIsSelectionOpen((current) => !current)}
                    testID="export-selection-toggle"
                  >
                    <ButtonText>{isSelectionOpen ? "Collapse" : "Expand"}</ButtonText>
                  </Button>
                </HStack>

                {isSelectionOpen && (
                  <VStack space="md">
                    <VStack space="xs">
                      <Text bold size="sm" color={theme.text}>
                        Search
                      </Text>
                      <Input variant="outline" size="md">
                        <InputField
                          value={search}
                          onChangeText={setSearch}
                          placeholder="Search by title or vendor"
                          testID="export-search-input"
                        />
                      </Input>
                    </VStack>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <HStack space="sm" alignItems="center" pr="$2">
                        <Button
                          size="sm"
                          variant={usageType ? "solid" : "outline"}
                          action={usageType ? "primary" : "secondary"}
                          onPress={() => setActiveSheet("usageType")}
                          testID="export-filter-usage"
                        >
                          <ButtonText>{usageChipLabel}</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant={categoryId ? "solid" : "outline"}
                          action={categoryId ? "primary" : "secondary"}
                          onPress={() => setActiveSheet("category")}
                          testID="export-filter-category"
                        >
                          <ButtonText>{categoryChipLabel}</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant={missingReceipt ? "solid" : "outline"}
                          action={missingReceipt ? "primary" : "secondary"}
                          onPress={() => setMissingReceipt((current) => !current)}
                          testID="export-filter-missing-receipt"
                        >
                          <ButtonText>Missing receipt</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant={missingNotes ? "solid" : "outline"}
                          action={missingNotes ? "primary" : "secondary"}
                          onPress={() => setMissingNotes((current) => !current)}
                          testID="export-filter-missing-notes"
                        >
                          <ButtonText>Missing notes</ButtonText>
                        </Button>
                      </HStack>
                    </ScrollView>

                    <HStack space="sm" flexWrap="wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        action="secondary"
                        onPress={toggleSelectAllFiltered}
                        disabled={filteredItems.length === 0}
                        testID="export-select-all-filtered"
                      >
                        <ButtonText>{allFilteredSelected ? "Unselect filtered" : "Select all filtered"}</ButtonText>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        action="secondary"
                        onPress={clearFilters}
                        testID="export-clear-filters"
                      >
                        <ButtonText>Clear filters</ButtonText>
                      </Button>
                    </HStack>

                    <Badge size="sm" action="muted" variant="outline" alignSelf="flex-start">
                      <BadgeText>{filteredItems.length} filtered item(s)</BadgeText>
                    </Badge>

                    {isLoading ? (
                      <Card borderWidth="$1" borderColor="$border200">
                        <HStack alignItems="center" space="sm">
                          <Spinner size="small" />
                          <Text color={theme.textSecondary}>Loading export items...</Text>
                        </HStack>
                      </Card>
                    ) : filteredItems.length === 0 ? (
                      <Card borderWidth="$1" borderColor="$border200" testID="export-empty-state">
                        <Text color={theme.textSecondary}>
                          No items found. Adjust filters or add a new item.
                        </Text>
                      </Card>
                    ) : (
                      filteredItems.map((item) => {
                        const categoryName = item.categoryId
                          ? categoryMap.get(item.categoryId)?.name ?? "Unknown"
                          : "No category";

                        return (
                          <ExportItemRow
                            key={item.id}
                            item={item}
                            categoryName={categoryName}
                            deductibleThisYearCents={deductibleByItemId.get(item.id) ?? 0}
                            selected={selectedItemIds.has(item.id)}
                            missingReceipt={missingReceiptItemIds.has(item.id)}
                            missingNotes={missingNotesForItem(item)}
                            onToggle={toggleItemSelection}
                          />
                        );
                      })
                    )}
                  </VStack>
                )}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="lg" color={theme.text}>
                  Totals summary
                </Heading>

                <HStack justifyContent="space-between" alignItems="center" flexWrap="wrap" space="sm">
                  <VStack space="xs" minWidth={140}>
                    <Text size="sm" color={theme.textSecondary}>
                      Selected items
                    </Text>
                    <Heading size="xl" color={theme.text}>
                      {selectedItems.length}
                    </Heading>
                  </VStack>
                  <VStack space="xs" minWidth={140}>
                    <Text size="sm" color={theme.textSecondary}>
                      Deductible this year
                    </Text>
                    <Heading size="xl" color={theme.text}>
                      {formatCents(totals.deductibleThisYearCents)}
                    </Heading>
                  </VStack>
                  <VStack space="xs" minWidth={140}>
                    <Text size="sm" color={theme.textSecondary}>
                      Estimated refund
                    </Text>
                    <Heading size="xl" color={theme.text}>
                      {formatCents(totals.estimatedRefundCents)}
                    </Heading>
                  </VStack>
                </HStack>

                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm" color={theme.textSecondary}>
                    Include detail pages
                  </Text>
                  <Switch
                    value={includeDetailPages}
                    onValueChange={setIncludeDetailPages}
                    testID="export-include-detail-pages"
                  />
                </HStack>

                <VStack space="xs">
                  <Text bold size="sm" color={theme.text}>
                    Format
                  </Text>
                  <HStack space="sm">
                    <Button
                      flex={1}
                      variant={selectedFormat === "PDF" ? "solid" : "outline"}
                      action={selectedFormat === "PDF" ? "primary" : "secondary"}
                      onPress={() => setSelectedFormat("PDF")}
                      testID="export-format-pdf"
                    >
                      <ButtonText>PDF</ButtonText>
                    </Button>
                    <Button
                      flex={1}
                      variant={selectedFormat === "ZIP" ? "solid" : "outline"}
                      action={selectedFormat === "ZIP" ? "primary" : "secondary"}
                      onPress={() => setSelectedFormat("ZIP")}
                      testID="export-format-zip"
                    >
                      <ButtonText>ZIP</ButtonText>
                    </Button>
                  </HStack>
                </VStack>

                <Box testID="export-btn-submit">
                  <Button
                    onPress={() => void handleGenerateExport()}
                    disabled={isGenerateDisabled}
                    style={generateButtonStyle}
                    testID="export-generate"
                    accessibilityState={{ disabled: isGenerateDisabled }}
                  >
                    <ButtonText color={generateButtonTextColor}>
                      {isGenerating ? `Generating ${selectedFormat}...` : "Generate Export"}
                    </ButtonText>
                  </Button>
                </Box>
                {!hasSelectedItems && (
                  <Text size="sm" color={theme.textSecondary} testID="export-no-items-hint">
                    Select at least one item in the Select items section to generate an export.
                  </Text>
                )}

                {latestGeneratedFileName && (
                  <Text size="sm" color={theme.textSecondary}>
                    Last export: {latestGeneratedFileName}
                  </Text>
                )}
                {latestGeneratedFileUri && (
                  <Text size="sm" color={theme.textMuted} testID="export-last-local-file-uri">
                    Local file: {latestGeneratedFileUri}
                  </Text>
                )}
                {latestGeneratedFileUri && latestGeneratedFormat && (
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleShareLatestGeneratedExport()}
                    testID="export-share-latest"
                  >
                    <ButtonText>Share latest</ButtonText>
                  </Button>
                )}
                {zipProgress && (
                  <Text size="sm" color={theme.textMuted}>
                    ZIP progress: {zipProgress.percent}% - {zipProgress.message}
                  </Text>
                )}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md" color={theme.text}>
                  Save destination
                </Heading>
                <Text size="sm" color={theme.textSecondary}>
                  App storage (always): {localExportDirectoryUri}
                </Text>

                {supportsDirectoryPicker ? (
                  <>
                    <Text size="sm" color={theme.textSecondary}>
                      Selected folder: {savedDirectoryLabel}
                    </Text>
                    <HStack space="sm" flexWrap="wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        action="secondary"
                        onPress={() => void handlePickExportDirectory()}
                        testID="export-select-folder"
                      >
                        <ButtonText>
                          {savedDirectoryUri ? "Change folder" : "Choose folder"}
                        </ButtonText>
                      </Button>
                      {savedDirectoryUri && (
                        <Button
                          size="sm"
                          variant="outline"
                          action="secondary"
                          onPress={() => void handleClearExportDirectory()}
                          testID="export-clear-folder"
                        >
                          <ButtonText>Clear folder</ButtonText>
                        </Button>
                      )}
                    </HStack>
                    <Text size="xs" color={theme.textMuted}>
                      Android: choose a folder once, and each new export is copied there.
                    </Text>
                  </>
                ) : (
                  <Text size="xs" color={theme.textMuted}>
                    {Platform.OS === "ios"
                      ? "iOS: use Share latest or Share again and save the file to Files."
                      : "Folder selection is unavailable on this platform. Use Share latest or Share again."}
                  </Text>
                )}

                {latestSavedDirectoryFileUri && (
                  <Text size="sm" color={theme.textMuted} testID="export-last-folder-file-uri">
                    Folder copy: {latestSavedDirectoryFileUri}
                  </Text>
                )}
                {directorySaveError && (
                  <Text size="sm" color={theme.danger} testID="export-folder-save-error">
                    {directorySaveError}
                  </Text>
                )}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <HStack justifyContent="space-between" alignItems="center" space="sm">
                  <VStack space="xs" flex={1}>
                    <Heading size="md" color={theme.text}>
                      Export history
                    </Heading>
                    <Text size="sm" color={theme.textSecondary}>
                      {exportHistory.length} run(s) in selected tax year
                    </Text>
                  </VStack>
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={() => setIsHistoryOpen((current) => !current)}
                    testID="export-history-toggle"
                  >
                    <ButtonText>{isHistoryOpen ? "Hide" : "Show"}</ButtonText>
                  </Button>
                </HStack>

                {isHistoryOpen && (
                  <VStack space="sm">
                    {exportHistory.length === 0 ? (
                      <Text size="sm" color={theme.textSecondary}>
                        No exports recorded for this tax year yet.
                      </Text>
                    ) : (
                      exportHistory.map((run) => (
                        <HStack
                          key={run.id}
                          justifyContent="space-between"
                          alignItems="center"
                          space="sm"
                          flexWrap="wrap"
                        >
                          <VStack space="xs" flex={1}>
                            <Text bold size="sm" color={theme.text}>
                              {run.outputType}
                            </Text>
                            <Text size="sm" color={theme.textSecondary}>
                              {run.createdAt} | Items: {run.itemCount}
                            </Text>
                            <Text size="sm" color={theme.textSecondary}>
                              Deductible: {formatCents(run.totalDeductibleCents)} | Refund:{" "}
                              {formatCents(run.estimatedRefundCents)}
                            </Text>
                          </VStack>
                          <Button
                            size="sm"
                            variant="outline"
                            action="secondary"
                            onPress={() => void handleShareHistoryRun(run)}
                          >
                            <ButtonText>Share again</ButtonText>
                          </Button>
                        </HStack>
                      ))
                    )}
                  </VStack>
                )}
              </VStack>
            </Card>

            {loadError && (
              <Card borderWidth="$1" borderColor="$error300">
                <HStack justifyContent="space-between" alignItems="center" space="md" flexWrap="wrap">
                  <Text size="sm" color={theme.danger}>
                    {loadError}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={() => void loadData()}
                    testID="export-retry"
                  >
                    <ButtonText>Retry</ButtonText>
                  </Button>
                </HStack>
              </Card>
            )}
          </VStack>
        </ScrollView>

        <Actionsheet isOpen={activeSheet !== null} onClose={() => setActiveSheet(null)}>
          <ActionsheetBackdrop />
          <ActionsheetContent>
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator />
            </ActionsheetDragIndicatorWrapper>

            {activeSheet === "usageType" && (
              <>
                {usageOptions.map((option) => (
                  <ActionsheetItem
                    key={option.label}
                    onPress={() => {
                      setUsageType(option.value);
                      setActiveSheet(null);
                    }}
                  >
                    <ActionsheetItemText>{option.label}</ActionsheetItemText>
                  </ActionsheetItem>
                ))}
              </>
            )}

            {activeSheet === "category" && (
              <>
                <ActionsheetItem
                  onPress={() => {
                    setCategoryId(null);
                    setActiveSheet(null);
                  }}
                >
                  <ActionsheetItemText>All categories</ActionsheetItemText>
                </ActionsheetItem>
                {categories.map((category) => (
                  <ActionsheetItem
                    key={category.id}
                    onPress={() => {
                      setCategoryId(category.id);
                      setActiveSheet(null);
                    }}
                  >
                    <ActionsheetItemText>{category.name}</ActionsheetItemText>
                  </ActionsheetItem>
                ))}
              </>
            )}
          </ActionsheetContent>
        </Actionsheet>
      </Box>
    </SafeAreaView>
  );
}
