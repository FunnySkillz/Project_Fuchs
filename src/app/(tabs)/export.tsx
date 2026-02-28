import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { Badge, Button, Card, FormField, Input, Select } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import type { Category } from "@/models/category";
import type { Item, ItemUsageType } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import { getCategoryRepository, getItemRepository } from "@/repositories/create-core-repositories";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import {
  getExportSelectionSessionState,
  updateExportSelectionSessionState,
} from "@/services/export-selection-session";
import { formatCents } from "@/utils/money";
import { generatePdfExport, shareExportPdf } from "@/services/pdf-export";
import { generateZipExport, shareExportZip } from "@/services/zip-export";
import { friendlyFileErrorMessage } from "@/services/friendly-errors";

const usageOptions: { value: string; label: string }[] = [
  { value: "__all", label: "All usage types" },
  { value: "WORK", label: "Work" },
  { value: "PRIVATE", label: "Private" },
  { value: "MIXED", label: "Mixed" },
  { value: "OTHER", label: "Other" },
];

function parseYearInput(rawYear: string): number | undefined {
  const trimmed = rawYear.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface ExportItemRowProps {
  item: Item;
  isSelected: boolean;
  categoryName: string;
  onToggleSelection: (itemId: string) => void;
}

const ExportItemRow = React.memo(function ExportItemRow({
  item,
  isSelected,
  categoryName,
  onToggleSelection,
}: ExportItemRowProps) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.rowBetween}>
        <View style={styles.itemTextGroup}>
          <ThemedText type="smallBold">{item.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.purchaseDate} | {formatCents(item.totalCents)} | {item.usageType}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Vendor: {item.vendor?.trim() ? item.vendor : "-"} | Category: {categoryName}
          </ThemedText>
        </View>
        <Button
          variant={isSelected ? "primary" : "secondary"}
          label={isSelected ? "Selected" : "Select"}
          onPress={() => onToggleSelection(item.id)}
        />
      </View>
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

  const [yearItems, setYearItems] = useState<Item[]>([]);
  const [missingReceiptItemIds, setMissingReceiptItemIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const parsedTaxYear = useMemo(() => parseYearInput(taxYear), [taxYear]);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const categoryOptions = useMemo(
    () => [
      { value: "__all", label: "All categories" },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories]
  );

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
  }, [
    categoryId,
    missingNotes,
    missingReceipt,
    search,
    selectedItemIds,
    taxYear,
    usageType,
  ]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [itemRepository, categoryRepository, profileSettingsRepository] = await Promise.all([
        getItemRepository(),
        getCategoryRepository(),
        getProfileSettingsRepository(),
      ]);

      const loadedSettings = await profileSettingsRepository.getSettings();
      const targetYear = parsedTaxYear ?? loadedSettings.taxYearDefault;

      const [loadedItems, loadedCategories, loadedMissingReceiptIds] = await Promise.all([
        itemRepository.list({ year: targetYear }),
        categoryRepository.list(),
        itemRepository.listMissingReceiptItemIds({ year: targetYear }),
      ]);

      setYearItems(loadedItems);
      setMissingReceiptItemIds(new Set(loadedMissingReceiptIds));
      setCategories(loadedCategories);
      setSettings(loadedSettings);

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
      if (
        missingNotes &&
        !(item.notes === null || item.notes.trim().length === 0)
      ) {
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

  const handleToggleItemSelection = useCallback((itemId: string) => {
    toggleItemSelection(itemId);
  }, []);

  const toggleSelectAllFiltered = () => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredItemIds.forEach((id) => {
          next.delete(id);
        });
      } else {
        filteredItemIds.forEach((id) => {
          next.add(id);
        });
      }
      return next;
    });
  };

  const selectedItems = useMemo(
    () => yearItems.filter((item) => selectedItemIds.has(item.id)),
    [selectedItemIds, yearItems]
  );

  const totals = useMemo(() => {
    if (!settings) {
      return {
        deductibleThisYearCents: 0,
        estimatedRefundCents: 0,
      };
    }

    const targetYear = parsedTaxYear ?? settings.taxYearDefault;
    const deductibleThisYearCents = selectedItems.reduce((sum, item) => {
      return sum + computeDeductibleImpactCents(item, settings, categoryMap, targetYear);
    }, 0);
    const estimatedRefundCents = Math.round(
      (deductibleThisYearCents * settings.marginalRateBps) / 10_000
    );

    return {
      deductibleThisYearCents,
      estimatedRefundCents,
    };
  }, [categoryMap, parsedTaxYear, selectedItems, settings]);

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
      const targetYear = parsedTaxYear ?? settings.taxYearDefault;
      const result = await generatePdfExport({
        taxYear: targetYear,
        selectedItems,
        categories,
        settings,
        includeDetailPages,
      });
      setLatestPdfUri(result.fileUri);
      setLatestPdfName(result.fileName);
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
    setLoadError(null);
    try {
      const targetYear = parsedTaxYear ?? settings.taxYearDefault;
      const result = await generateZipExport({
        taxYear: targetYear,
        selectedItems,
        categories,
        settings,
        includeDetailPages,
      });
      setLatestZipUri(result.fileUri);
      setLatestZipName(result.fileName);
      setLatestZipSizeBytes(result.sizeBytes);
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

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        initialNumToRender={14}
        windowSize={10}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={40}
        removeClippedSubviews
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <ThemedText type="title">Export Selection</ThemedText>
            <ThemedText themeColor="textSecondary">
              Choose items for a tax year export and preview totals before generating files.
            </ThemedText>

            <Card>
              <FormField label="Tax Year">
                <Input
                  value={taxYear}
                  onChangeText={setTaxYear}
                  keyboardType="number-pad"
                  placeholder={settings ? String(settings.taxYearDefault) : "e.g. 2026"}
                  maxLength={4}
                />
              </FormField>

              <FormField label="Search (Title/Vendor)">
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by title or vendor"
                />
              </FormField>

              <FormField label="Category">
                <Select
                  value={categoryId ?? "__all"}
                  options={categoryOptions}
                  onChange={(nextValue) =>
                    setCategoryId(nextValue === "__all" ? null : nextValue)
                  }
                />
              </FormField>

              <FormField label="Usage Type">
                <Select
                  value={usageType ?? "__all"}
                  options={usageOptions}
                  onChange={(nextValue) =>
                    setUsageType(nextValue === "__all" ? null : (nextValue as ItemUsageType))
                  }
                />
              </FormField>

              <View style={styles.row}>
                <Button
                  variant={missingReceipt ? "primary" : "secondary"}
                  label={missingReceipt ? "Missing Receipt: ON" : "Missing Receipt: OFF"}
                  onPress={() => setMissingReceipt((current) => !current)}
                />
                <Button
                  variant={missingNotes ? "primary" : "secondary"}
                  label={missingNotes ? "Missing Notes: ON" : "Missing Notes: OFF"}
                  onPress={() => setMissingNotes((current) => !current)}
                />
              </View>

              <View style={styles.row}>
                <Button
                  variant="secondary"
                  label={allFilteredSelected ? "Unselect Filtered" : "Select All Filtered"}
                  onPress={toggleSelectAllFiltered}
                  disabled={filteredItems.length === 0}
                />
                <Button
                  variant="ghost"
                  label="Clear Filters + Selection"
                  onPress={clearFiltersAndSelection}
                />
              </View>
            </Card>

            <Card>
              <ThemedText type="smallBold">Export Preview Summary</ThemedText>
              <ThemedText type="small">Selected items: {selectedItems.length}</ThemedText>
              <ThemedText type="small">
                Deductible this year: {formatCents(totals.deductibleThisYearCents)}
              </ThemedText>
              <ThemedText type="small">
                Estimated refund impact: {formatCents(totals.estimatedRefundCents)}
              </ThemedText>
              <View style={styles.row}>
                <Button
                  variant={includeDetailPages ? "primary" : "secondary"}
                  label={
                    includeDetailPages
                      ? "Detail Pages: ON"
                      : "Detail Pages: OFF"
                  }
                  onPress={() => setIncludeDetailPages((current) => !current)}
                />
                <Button
                  label={isGeneratingPdf ? "Generating PDF..." : "Generate PDF"}
                  onPress={() => void handleGeneratePdf()}
                  disabled={selectedItems.length === 0 || isGeneratingPdf}
                />
                <Button
                  variant="secondary"
                  label={isSharingPdf ? "Sharing..." : "Share PDF"}
                  onPress={() => void handleSharePdf()}
                  disabled={!latestPdfUri || isSharingPdf}
                />
                <Button
                  label={isGeneratingZip ? "Generating ZIP..." : "Generate ZIP"}
                  onPress={() => void handleGenerateZip()}
                  disabled={selectedItems.length === 0 || isGeneratingZip}
                />
                <Button
                  variant="secondary"
                  label={isSharingZip ? "Sharing ZIP..." : "Share ZIP"}
                  onPress={() => void handleShareZip()}
                  disabled={!latestZipUri || isSharingZip}
                />
              </View>
              {latestPdfName && (
                <ThemedText type="small" themeColor="textSecondary">
                  Last PDF: {latestPdfName}
                </ThemedText>
              )}
              {latestZipName && (
                <ThemedText type="small" themeColor="textSecondary">
                  Last ZIP: {latestZipName}
                  {latestZipSizeBytes !== null
                    ? ` (${(latestZipSizeBytes / 1024 / 1024).toFixed(2)} MB)`
                    : ""}
                </ThemedText>
              )}
            </Card>

            <View style={styles.metaRow}>
              <Badge text={`${filteredItems.length} filtered item(s)`} />
              {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}
            </View>
            {isLoading && <ActivityIndicator />}
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedItemIds.has(item.id);
          const categoryName = item.categoryId
            ? categoryMap.get(item.categoryId)?.name ?? "Unknown"
            : "None";

          return (
            <ExportItemRow
              item={item}
              isSelected={isSelected}
              categoryName={categoryName}
              onToggleSelection={handleToggleItemSelection}
            />
          );
        }}
        ListEmptyComponent={
          !isLoading && !loadError ? (
            <Card>
              <ThemedText type="smallBold">No items found</ThemedText>
              <ThemedText themeColor="textSecondary">
                No entries match the selected tax year/filters.
              </ThemedText>
            </Card>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerSection: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  itemTextGroup: {
    flex: 1,
    gap: Spacing.one,
  },
  itemCard: {
    marginBottom: Spacing.two,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  errorText: {
    color: "#B00020",
  },
});
