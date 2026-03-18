import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
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

import { useI18n } from "@/contexts/language-context";
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

const usageOptionValues: readonly (ItemUsageType | null)[] = [null, "WORK", "PRIVATE", "MIXED", "OTHER"];
const TAX_YEAR_MIN = 1900;
const TAX_YEAR_MAX = 2100;

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

function getTaxYearValidationMessage(
  rawYear: string,
  t: ReturnType<typeof useI18n>["t"]
): string | null {
  const trimmed = rawYear.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return t("export.taxYear.validation.format");
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < TAX_YEAR_MIN || parsed > TAX_YEAR_MAX) {
    return t("export.taxYear.validation.range");
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
  const { t } = useI18n();

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
              {t("items.row.deductibleThisYear", { amount: formatCents(deductibleThisYearCents) })}
            </Text>
          </VStack>
          <Text bold size="md" color={theme.text}>
            {formatCents(item.totalCents)}
          </Text>
        </HStack>

        <HStack space="sm" flexWrap="wrap">
          {missingReceipt && (
            <Badge size="sm" action="warning" variant="outline">
              <BadgeText>{t("items.badge.missingReceipt")}</BadgeText>
            </Badge>
          )}
          {missingNotes && (
            <Badge size="sm" action="warning" variant="outline">
              <BadgeText>{t("items.badge.missingNotes")}</BadgeText>
            </Badge>
          )}
          <Badge size="sm" action={selected ? "success" : "muted"} variant="outline">
            <BadgeText>{selected ? t("export.selection.selected") : t("export.selection.notSelected")}</BadgeText>
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
            <ButtonText>{selected ? t("export.selection.unselect") : t("export.selection.select")}</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
});

export default function ExportRoute() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t } = useI18n();
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
  const [isIosYearPickerOpen, setIsIosYearPickerOpen] = useState(false);

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
  const taxYearError = useMemo(() => getTaxYearValidationMessage(taxYear, t), [t, taxYear]);
  const isGenerateFormValid = taxYearError === null;
  const shouldShowTaxYearError = Boolean((submitAttempted || touchedFields.taxYear) && taxYearError);
  const supportsIosNativeYearPicker = Platform.OS === "ios";
  const initialPickerYear = parsedTaxYear ?? settings?.taxYearDefault ?? new Date().getFullYear();
  const clampedPickerYear = Math.max(TAX_YEAR_MIN, Math.min(TAX_YEAR_MAX, initialPickerYear));
  const [iosYearPickerValue, setIosYearPickerValue] = useState<number>(clampedPickerYear);
  const availableTaxYears = useMemo(
    () =>
      Array.from(
        { length: TAX_YEAR_MAX - TAX_YEAR_MIN + 1 },
        (_, index) => TAX_YEAR_MIN + index
      ),
    []
  );
  const taxYearDisplayValue =
    taxYear.trim().length > 0
      ? taxYear
      : settings
        ? String(settings.taxYearDefault)
        : t("export.taxYear.placeholderExample");
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const usageOptions = useMemo(
    () =>
      usageOptionValues.map((value) => ({
        value,
        label: value ? value : t("items.filter.usage.all"),
      })),
    [t]
  );
  const usageChipLabel = usageType
    ? t("items.filter.usage.label", { usage: usageType })
    : t("items.filter.usage.allLabel");
  const categoryChipLabel = categoryId
    ? t("items.filter.category.label", {
        category: categoryMap.get(categoryId)?.name ?? t("items.category.unknown"),
      })
    : t("items.filter.category.all");
  const supportsDirectoryPicker = useMemo(() => isExportDirectoryPickerSupported(), []);
  const localExportDirectoryUri = useMemo(() => {
    try {
      return getLocalExportDirectoryUri();
    } catch {
      return t("export.destination.unavailable");
    }
  }, [t]);
  const savedDirectoryLabel = savedDirectoryUri
    ? formatDirectoryUriForDisplay(savedDirectoryUri)
    : t("settings.backupSync.oneDrive.notSelected");

  useEffect(() => {
    if (isIosYearPickerOpen) {
      return;
    }
    setIosYearPickerValue(clampedPickerYear);
  }, [clampedPickerYear, isIosYearPickerOpen]);

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
      setLoadError(t("export.loadErrorSelection"));
    } finally {
      setIsLoading(false);
    }
  }, [parsedTaxYear, t]);

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
    if (supportsIosNativeYearPicker) {
      setIsIosYearPickerOpen(true);
      return;
    }
    focusField("taxYear");
  }, [focusField, scrollToField, supportsIosNativeYearPicker, taxYearError]);

  const openIosYearPicker = useCallback(() => {
    setIosYearPickerValue(clampedPickerYear);
    setIsIosYearPickerOpen(true);
  }, [clampedPickerYear]);

  const closeIosYearPicker = useCallback(() => {
    setIsIosYearPickerOpen(false);
  }, []);

  const confirmIosYearPicker = useCallback(() => {
    setTaxYear(String(iosYearPickerValue));
    setTouchedFields((current) => ({ ...current, taxYear: true }));
    setIsIosYearPickerOpen(false);
  }, [iosYearPickerValue]);

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
            t("export.destination.copyFailed")
          )
        );
      }
    },
    [savedDirectoryUri, supportsDirectoryPicker, t]
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
      setLoadError(friendlyFileErrorMessage(error, t("export.destination.chooseFolderError")));
    }
  }, [savedDirectoryUri, supportsDirectoryPicker, t]);

  const handleClearExportDirectory = useCallback(async () => {
    try {
      await clearSavedExportDirectoryUri();
      setSavedDirectoryUri(null);
      setLatestSavedDirectoryFileUri(null);
      setDirectorySaveError(null);
    } catch (error) {
      console.error("Failed to clear saved export directory", error);
      setLoadError(friendlyFileErrorMessage(error, t("export.destination.clearFolderError")));
    }
  }, [t]);

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
      setLoadError(friendlyFileErrorMessage(error, t("export.shareLatestError")));
    }
  }, [latestGeneratedFileUri, latestGeneratedFormat, t]);

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
          selectedFormat === "PDF"
            ? t("export.generateErrorPdf")
            : t("export.generateErrorZip")
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareHistoryRun = async (run: ExportRun) => {
    if (!run.outputFilePath) {
      setLoadError(t("export.history.missingOutputPath"));
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
      setLoadError(friendlyFileErrorMessage(error, t("export.history.shareError")));
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
                  {t("navigation.tabs.export")}
                </Heading>
                <Text size="sm" color={theme.textSecondary}>
                  {t("export.subtitle")}
                </Text>
              </VStack>

              <Card borderWidth="$1" borderColor="$border200">
                <VStack space="sm">
                  <Text bold size="sm" color={theme.text}>
                    {t("export.taxYear.label")}
                  </Text>
                <Box
                  testID="export-input-taxYear"
                  onLayout={(event) => {
                    fieldYRef.current.taxYear = event.nativeEvent.layout.y;
                  }}
                >
                  {supportsIosNativeYearPicker ? (
                    <VStack space="sm">
                      <Button
                        variant="outline"
                        action="secondary"
                        onPress={openIosYearPicker}
                        testID="export-tax-year-picker-trigger"
                        accessibilityLabel={t("export.taxYear.label")}
                        accessibilityState={({ invalid: shouldShowTaxYearError } as any)}
                      >
                        <ButtonText>{taxYearDisplayValue}</ButtonText>
                      </Button>
                      {isIosYearPickerOpen && (
                        <Card borderWidth="$1" borderColor="$border200" style={{ backgroundColor: theme.background }}>
                          <VStack space="sm">
                            <Box borderWidth="$1" borderColor="$border200" borderRadius="$md" overflow="hidden">
                              <Picker
                                selectedValue={iosYearPickerValue}
                                onValueChange={(selection) => {
                                  if (typeof selection === "number") {
                                    setIosYearPickerValue(selection);
                                  }
                                }}
                                itemStyle={{ color: theme.text, fontSize: 22 }}
                                style={{ color: theme.text, height: 180 }}
                                testID="export-tax-year-picker-ios"
                              >
                                {availableTaxYears.map((year) => (
                                  <Picker.Item key={year} label={String(year)} value={year} />
                                ))}
                              </Picker>
                            </Box>
                            <HStack justifyContent="flex-end" space="sm">
                              <Button
                                size="sm"
                                variant="outline"
                                action="secondary"
                                onPress={closeIosYearPicker}
                              >
                                <ButtonText>{t("common.action.cancel")}</ButtonText>
                              </Button>
                              <Button size="sm" onPress={confirmIosYearPicker}>
                                <ButtonText>{t("common.action.done")}</ButtonText>
                              </Button>
                            </HStack>
                          </VStack>
                        </Card>
                      )}
                    </VStack>
                  ) : (
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
                        placeholder={
                          settings
                            ? String(settings.taxYearDefault)
                            : t("export.taxYear.placeholderExample")
                        }
                        testID="export-tax-year-input"
                        accessibilityState={({ invalid: shouldShowTaxYearError } as any)}
                        onBlur={() => {
                          setTouchedFields((current) => ({ ...current, taxYear: true }));
                        }}
                      />
                    </Input>
                  )}
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
                      {t("export.selection.title")}
                    </Heading>
                    <Text size="sm" color={theme.textSecondary}>
                      {t("export.selection.count", { count: selectedItems.length })}
                    </Text>
                  </VStack>
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={() => setIsSelectionOpen((current) => !current)}
                    testID="export-selection-toggle"
                  >
                    <ButtonText>
                      {isSelectionOpen ? t("settings.taxCalculation.collapse") : t("settings.taxCalculation.expand")}
                    </ButtonText>
                  </Button>
                </HStack>

                {isSelectionOpen && (
                  <VStack space="md">
                    <VStack space="xs">
                      <Text bold size="sm" color={theme.text}>
                        {t("common.search.placeholder")}
                      </Text>
                      <Input variant="outline" size="md">
                        <InputField
                          value={search}
                          onChangeText={setSearch}
                          placeholder={t("export.searchPlaceholder")}
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
                          <ButtonText>{t("items.filter.missingReceipt")}</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          variant={missingNotes ? "solid" : "outline"}
                          action={missingNotes ? "primary" : "secondary"}
                          onPress={() => setMissingNotes((current) => !current)}
                          testID="export-filter-missing-notes"
                        >
                          <ButtonText>{t("items.filter.missingNotes")}</ButtonText>
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
                        <ButtonText>
                          {allFilteredSelected
                            ? t("export.selection.unselectFiltered")
                            : t("export.selection.selectAllFiltered")}
                        </ButtonText>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        action="secondary"
                        onPress={clearFilters}
                        testID="export-clear-filters"
                      >
                        <ButtonText>{t("common.action.clear")}</ButtonText>
                      </Button>
                    </HStack>

                    <Badge size="sm" action="muted" variant="outline" alignSelf="flex-start">
                      <BadgeText>{t("export.selection.filteredCount", { count: filteredItems.length })}</BadgeText>
                    </Badge>

                    {isLoading ? (
                      <Card borderWidth="$1" borderColor="$border200">
                        <HStack alignItems="center" space="sm">
                          <Spinner size="small" />
                          <Text color={theme.textSecondary}>{t("export.selection.loadingItems")}</Text>
                        </HStack>
                      </Card>
                    ) : filteredItems.length === 0 ? (
                      <Card borderWidth="$1" borderColor="$border200" testID="export-empty-state">
                        <Text color={theme.textSecondary}>
                          {t("items.emptyState.title")}
                        </Text>
                      </Card>
                    ) : (
                      filteredItems.map((item) => {
                        const categoryName = item.categoryId
                          ? categoryMap.get(item.categoryId)?.name ?? t("items.category.unknown")
                          : t("items.category.none");

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
                  {t("export.totals.title")}
                </Heading>

                <HStack justifyContent="space-between" alignItems="center" flexWrap="wrap" space="sm">
                  <VStack space="xs" minWidth={140}>
                    <Text size="sm" color={theme.textSecondary}>
                      {t("export.totals.selectedItems")}
                    </Text>
                    <Heading size="xl" color={theme.text}>
                      {selectedItems.length}
                    </Heading>
                  </VStack>
                  <VStack space="xs" minWidth={140}>
                    <Text size="sm" color={theme.textSecondary}>
                      {t("export.totals.deductible")}
                    </Text>
                    <Heading size="xl" color={theme.text}>
                      {formatCents(totals.deductibleThisYearCents)}
                    </Heading>
                  </VStack>
                  <VStack space="xs" minWidth={140}>
                    <Text size="sm" color={theme.textSecondary}>
                      {t("export.totals.refund")}
                    </Text>
                    <Heading size="xl" color={theme.text}>
                      {formatCents(totals.estimatedRefundCents)}
                    </Heading>
                  </VStack>
                </HStack>

                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm" color={theme.textSecondary}>
                    {t("export.includeDetailPages")}
                  </Text>
                  <Switch
                    value={includeDetailPages}
                    onValueChange={setIncludeDetailPages}
                    testID="export-include-detail-pages"
                  />
                </HStack>

                <VStack space="xs">
                  <Text bold size="sm" color={theme.text}>
                    {t("export.format")}
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
                      {isGenerating
                        ? t("export.generatingWithFormat", { format: selectedFormat })
                        : t("export.generate")}
                    </ButtonText>
                  </Button>
                </Box>
                {!hasSelectedItems && (
                  <Text size="sm" color={theme.textSecondary} testID="export-no-items-hint">
                    {t("export.noItemsHint")}
                  </Text>
                )}

                {latestGeneratedFileName && (
                  <Text size="sm" color={theme.textSecondary}>
                    {t("export.lastExport", { fileName: latestGeneratedFileName })}
                  </Text>
                )}
                {latestGeneratedFileUri && (
                  <Text size="sm" color={theme.textMuted} testID="export-last-local-file-uri">
                    {t("export.localFile", { filePath: latestGeneratedFileUri })}
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
                    <ButtonText>{t("export.shareLatest")}</ButtonText>
                  </Button>
                )}
                {zipProgress && (
                  <Text size="sm" color={theme.textMuted}>
                    {t("export.zipProgress", {
                      percent: zipProgress.percent,
                      message: zipProgress.message,
                    })}
                  </Text>
                )}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md" color={theme.text}>
                  {t("export.destination.title")}
                </Heading>
                <Text size="sm" color={theme.textSecondary}>
                  {t("export.destination.appStorage", { path: localExportDirectoryUri })}
                </Text>

                {supportsDirectoryPicker ? (
                  <>
                    <Text size="sm" color={theme.textSecondary}>
                      {t("export.destination.selectedFolder", { folder: savedDirectoryLabel })}
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
                          {savedDirectoryUri
                            ? t("export.destination.changeFolder")
                            : t("export.destination.chooseFolder")}
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
                          <ButtonText>{t("export.destination.clearFolder")}</ButtonText>
                        </Button>
                      )}
                    </HStack>
                    <Text size="xs" color={theme.textMuted}>
                      {t("export.destination.androidHint")}
                    </Text>
                  </>
                ) : (
                  <Text size="xs" color={theme.textMuted}>
                    {Platform.OS === "ios"
                      ? t("export.destination.iosHint")
                      : t("export.destination.unavailableHint")}
                  </Text>
                )}

                {latestSavedDirectoryFileUri && (
                  <Text size="sm" color={theme.textMuted} testID="export-last-folder-file-uri">
                    {t("export.destination.folderCopy", { path: latestSavedDirectoryFileUri })}
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
                      {t("export.history.title")}
                    </Heading>
                    <Text size="sm" color={theme.textSecondary}>
                      {t("export.history.count", { count: exportHistory.length })}
                    </Text>
                  </VStack>
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={() => setIsHistoryOpen((current) => !current)}
                    testID="export-history-toggle"
                  >
                    <ButtonText>{isHistoryOpen ? t("export.history.hide") : t("export.history.show")}</ButtonText>
                  </Button>
                </HStack>

                {isHistoryOpen && (
                  <VStack space="sm">
                    {exportHistory.length === 0 ? (
                      <Text size="sm" color={theme.textSecondary}>
                        {t("export.history.empty")}
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
                              {t("export.history.itemsLine", {
                                createdAt: run.createdAt,
                                itemCount: run.itemCount,
                              })}
                            </Text>
                            <Text size="sm" color={theme.textSecondary}>
                              {t("export.history.amountsLine", {
                                deductible: formatCents(run.totalDeductibleCents),
                                refund: formatCents(run.estimatedRefundCents),
                              })}
                            </Text>
                          </VStack>
                          <Button
                            size="sm"
                            variant="outline"
                            action="secondary"
                            onPress={() => void handleShareHistoryRun(run)}
                          >
                            <ButtonText>{t("export.history.shareAgain")}</ButtonText>
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
                    <ButtonText>{t("common.action.retry")}</ButtonText>
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
                  <ActionsheetItemText>{t("items.filter.category.allOption")}</ActionsheetItemText>
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
