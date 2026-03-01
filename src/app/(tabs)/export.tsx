import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView } from "react-native";
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

type FilterSheetKind = "usageType" | "category" | null;

const usageOptions: Array<{ label: string; value: ItemUsageType | null }> = [
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
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  return (
    <Card borderWidth="$1" borderColor="$border200" mb="$3">
      <VStack space="sm">
        <HStack justifyContent="space-between" alignItems="flex-start" space="md">
          <VStack space="xs" flex={1}>
            <Text bold size="md">
              {item.title}
            </Text>
            <Text size="sm">
              {categoryName} | {item.purchaseDate}
            </Text>
            <Text size="sm">Deductible this year: {formatCents(deductibleThisYearCents)}</Text>
          </VStack>
          <Text bold size="md">
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
  const sessionDefaults = useMemo(() => getExportSelectionSessionState(), []);

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
  const [latestPdfUri, setLatestPdfUri] = useState<string | null>(null);
  const [latestPdfName, setLatestPdfName] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [latestZipUri, setLatestZipUri] = useState<string | null>(null);
  const [latestZipName, setLatestZipName] = useState<string | null>(null);
  const [latestZipSizeBytes, setLatestZipSizeBytes] = useState<number | null>(null);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [isSharingZip, setIsSharingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipExportProgress | null>(null);
  const [activeSheet, setActiveSheet] = useState<FilterSheetKind>(null);

  const [yearItems, setYearItems] = useState<Item[]>([]);
  const [missingReceiptItemIds, setMissingReceiptItemIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const parsedTaxYear = useMemo(() => parseYearInput(taxYear), [taxYear]);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const yearChipLabel = parsedTaxYear ? `Year: ${parsedTaxYear}` : "Year: default";
  const usageChipLabel = usageType ? `Usage: ${usageType}` : "Usage: all";
  const categoryChipLabel = categoryId
    ? `Category: ${categoryMap.get(categoryId)?.name ?? "Unknown"}`
    : "Category: all";

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

  const clearFiltersAndSelection = () => {
    setSearch("");
    setCategoryId(null);
    setUsageType(null);
    setMissingReceipt(false);
    setMissingNotes(false);
    setSelectedItemIds(new Set());
  };

  const handleGeneratePdf = async () => {
    if (!settings || selectedItems.length === 0 || isGeneratingPdf) {
      return;
    }

    setIsGeneratingPdf(true);
    setLoadError(null);
    try {
      const result = await generatePdfExport({
        taxYear: targetYearForCalc,
        selectedItems,
        categories,
        settings,
        includeDetailPages,
      });
      setLatestPdfUri(result.fileUri);
      setLatestPdfName(result.fileName);

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
    } catch (error) {
      console.error("Failed to generate PDF export", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not generate PDF export."));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    if (!latestPdfUri || isSharingPdf) {
      return;
    }
    setIsSharingPdf(true);
    setLoadError(null);
    try {
      await shareExportPdf(latestPdfUri);
    } catch (error) {
      console.error("Failed to share PDF export", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not share PDF export."));
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handleGenerateZip = async () => {
    if (!settings || selectedItems.length === 0 || isGeneratingZip) {
      return;
    }

    setIsGeneratingZip(true);
    setZipProgress(null);
    setLoadError(null);
    try {
      const result = await generateZipExport({
        taxYear: targetYearForCalc,
        selectedItems,
        categories,
        settings,
        includeDetailPages,
        onProgress: (progress) => setZipProgress(progress),
      });
      setLatestZipUri(result.fileUri);
      setLatestZipName(result.fileName);
      setLatestZipSizeBytes(result.sizeBytes);

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
      console.error("Failed to generate ZIP export", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not generate ZIP export."));
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const handleShareZip = async () => {
    if (!latestZipUri || isSharingZip) {
      return;
    }
    setIsSharingZip(true);
    setLoadError(null);
    try {
      await shareExportZip(latestZipUri);
    } catch (error) {
      console.error("Failed to share ZIP export", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not share ZIP export."));
    } finally {
      setIsSharingZip(false);
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

  const renderHeader = () => (
    <VStack space="lg" maxWidth={900} width="$full" alignSelf="center" pb="$4">
      <VStack space="xs">
        <Heading size="2xl">Export</Heading>
        <Text size="sm">
          Select items, review totals, then generate PDF or ZIP for your tax year export.
        </Text>
      </VStack>

      <Card borderWidth="$1" borderColor="$border200">
        <VStack space="md">
          <VStack space="xs">
            <Text bold size="sm">
              Tax year
            </Text>
            <Input variant="outline" size="md">
              <InputField
                value={taxYear}
                onChangeText={setTaxYear}
                keyboardType="number-pad"
                maxLength={4}
                placeholder={settings ? String(settings.taxYearDefault) : "e.g. 2026"}
                testID="export-tax-year-input"
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text bold size="sm">
              Search
            </Text>
            <Input variant="outline" size="md">
              <InputField
                value={search}
                onChangeText={setSearch}
                placeholder="Search by title or vendor"
              />
            </Input>
          </VStack>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack space="sm" alignItems="center" pr="$2">
              <Button size="sm" variant="outline" action="secondary" disabled>
                <ButtonText>{yearChipLabel}</ButtonText>
              </Button>
              <Button
                size="sm"
                variant={usageType ? "solid" : "outline"}
                action={usageType ? "primary" : "secondary"}
                onPress={() => setActiveSheet("usageType")}
              >
                <ButtonText>{usageChipLabel}</ButtonText>
              </Button>
              <Button
                size="sm"
                variant={categoryId ? "solid" : "outline"}
                action={categoryId ? "primary" : "secondary"}
                onPress={() => setActiveSheet("category")}
              >
                <ButtonText>{categoryChipLabel}</ButtonText>
              </Button>
              <Button
                size="sm"
                variant={missingReceipt ? "solid" : "outline"}
                action={missingReceipt ? "primary" : "secondary"}
                onPress={() => setMissingReceipt((current) => !current)}
              >
                <ButtonText>Missing receipt</ButtonText>
              </Button>
              <Button
                size="sm"
                variant={missingNotes ? "solid" : "outline"}
                action={missingNotes ? "primary" : "secondary"}
                onPress={() => setMissingNotes((current) => !current)}
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
            >
              <ButtonText>{allFilteredSelected ? "Unselect filtered" : "Select all filtered"}</ButtonText>
            </Button>
            <Button size="sm" variant="outline" action="secondary" onPress={clearFiltersAndSelection}>
              <ButtonText>Clear filters + selection</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </Card>

      <Card borderWidth="$1" borderColor="$border200">
        <VStack space="sm">
          <Heading size="md">Totals summary</Heading>
          <Text size="sm">Selected items: {selectedItems.length}</Text>
          <Text size="sm">Deductible this year: {formatCents(totals.deductibleThisYearCents)}</Text>
          <Text size="sm">Estimated refund impact: {formatCents(totals.estimatedRefundCents)}</Text>

          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm">Include detail pages</Text>
            <Switch value={includeDetailPages} onValueChange={setIncludeDetailPages} />
          </HStack>

          <HStack space="sm" flexWrap="wrap">
            <Button
              onPress={() => void handleGeneratePdf()}
              disabled={selectedItems.length === 0 || isGeneratingPdf}
              testID="export-generate-pdf"
            >
              <ButtonText>{isGeneratingPdf ? "Generating PDF..." : "Generate PDF"}</ButtonText>
            </Button>
            <Button
              onPress={() => void handleGenerateZip()}
              disabled={selectedItems.length === 0 || isGeneratingZip}
              testID="export-generate-zip"
            >
              <ButtonText>{isGeneratingZip ? "Generating ZIP..." : "Generate ZIP"}</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="secondary"
              onPress={() => void handleSharePdf()}
              disabled={!latestPdfUri || isSharingPdf}
            >
              <ButtonText>{isSharingPdf ? "Sharing PDF..." : "Share PDF"}</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="secondary"
              onPress={() => void handleShareZip()}
              disabled={!latestZipUri || isSharingZip}
            >
              <ButtonText>{isSharingZip ? "Sharing ZIP..." : "Share ZIP"}</ButtonText>
            </Button>
          </HStack>

          {latestPdfName && <Text size="sm">Last PDF: {latestPdfName}</Text>}
          {latestZipName && (
            <Text size="sm">
              Last ZIP: {latestZipName}
              {latestZipSizeBytes !== null ? ` (${(latestZipSizeBytes / 1024 / 1024).toFixed(2)} MB)` : ""}
            </Text>
          )}
          {zipProgress && (
            <Text size="sm">
              ZIP progress: {zipProgress.percent}% - {zipProgress.message}
            </Text>
          )}
        </VStack>
      </Card>

      <Card borderWidth="$1" borderColor="$border200">
        <VStack space="sm">
          <Heading size="md">Export history</Heading>
          {exportHistory.length === 0 ? (
            <Text size="sm">No exports recorded for this tax year yet.</Text>
          ) : (
            exportHistory.map((run) => (
              <HStack key={run.id} justifyContent="space-between" alignItems="center" space="sm" flexWrap="wrap">
                <VStack space="xs" flex={1}>
                  <Text bold size="sm">
                    {run.outputType}
                  </Text>
                  <Text size="sm">
                    {run.createdAt} | Items: {run.itemCount}
                  </Text>
                  <Text size="sm">
                    Deductible: {formatCents(run.totalDeductibleCents)} | Refund:{" "}
                    {formatCents(run.estimatedRefundCents)}
                  </Text>
                </VStack>
                <Button size="sm" variant="outline" action="secondary" onPress={() => void handleShareHistoryRun(run)}>
                  <ButtonText>Share again</ButtonText>
                </Button>
              </HStack>
            ))
          )}
        </VStack>
      </Card>

      {loadError && (
        <Card borderWidth="$1" borderColor="$error300">
          <HStack justifyContent="space-between" alignItems="center" space="md" flexWrap="wrap">
            <Text size="sm">{loadError}</Text>
            <Button size="sm" variant="outline" action="secondary" onPress={() => void loadData()}>
              <ButtonText>Retry</ButtonText>
            </Button>
          </HStack>
        </Card>
      )}

      <HStack justifyContent="space-between" alignItems="center">
        <Badge size="sm" action="muted" variant="outline">
          <BadgeText>{filteredItems.length} filtered item(s)</BadgeText>
        </Badge>
      </HStack>
    </VStack>
  );

  return (
    <Box flex={1} px="$5" py="$6">
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <VStack maxWidth={900} width="$full" alignSelf="center">
            {isLoading ? (
              <Card borderWidth="$1" borderColor="$border200">
                <HStack alignItems="center" space="sm">
                  <Spinner size="small" />
                  <Text>Loading export items...</Text>
                </HStack>
              </Card>
            ) : loadError ? (
              <Card borderWidth="$1" borderColor="$error300">
                <Text>Could not load export items. Retry above.</Text>
              </Card>
            ) : (
              <Card borderWidth="$1" borderColor="$border200" testID="export-empty-state">
                <Text>No items found. Adjust filters or add a new item.</Text>
              </Card>
            )}
          </VStack>
        }
        renderItem={({ item }) => {
          const categoryName = item.categoryId
            ? categoryMap.get(item.categoryId)?.name ?? "Unknown"
            : "No category";
          return (
            <ExportItemRow
              item={item}
              categoryName={categoryName}
              deductibleThisYearCents={deductibleByItemId.get(item.id) ?? 0}
              selected={selectedItemIds.has(item.id)}
              missingReceipt={missingReceiptItemIds.has(item.id)}
              missingNotes={missingNotesForItem(item)}
              onToggle={toggleItemSelection}
            />
          );
        }}
      />

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
  );
}
