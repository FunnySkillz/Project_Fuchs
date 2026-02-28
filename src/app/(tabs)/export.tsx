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

  const [items, setItems] = useState<Item[]>([]);
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
      const baseFilters = {
        year: targetYear,
        categoryId: categoryId ?? undefined,
        usageType: usageType ?? undefined,
        missingReceipt,
        missingNotes,
      };

      const [loadedItems, loadedCategories] = await Promise.all([
        itemRepository.list(baseFilters),
        categoryRepository.list(),
      ]);

      setItems(loadedItems);
      setCategories(loadedCategories);
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Failed to load export selection data", error);
      setLoadError("Could not load export selection data.");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, missingNotes, missingReceipt, parsedTaxYear, usageType]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    if (searchTerm.length === 0) {
      return items;
    }

    return items.filter((item) => {
      const haystack = `${item.title} ${item.vendor ?? ""}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [items, search]);

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
    () => items.filter((item) => selectedItemIds.has(item.id)),
    [items, selectedItemIds]
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

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
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
              <ThemedText type="small">Selected items: {selectedItemIds.size}</ThemedText>
              <ThemedText type="small">
                Deductible this year: {formatCents(totals.deductibleThisYearCents)}
              </ThemedText>
              <ThemedText type="small">
                Estimated refund impact: {formatCents(totals.estimatedRefundCents)}
              </ThemedText>
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
                  onPress={() => toggleItemSelection(item.id)}
                />
              </View>
            </Card>
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
