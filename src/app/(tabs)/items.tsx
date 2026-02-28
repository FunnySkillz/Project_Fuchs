import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { formatCents } from "@/utils/money";
import {
  getItemListSessionState,
  updateItemListSessionState,
  type ItemSortMode,
} from "@/services/item-list-session";

function toSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseYearInput(rawYear: string): number | undefined {
  const trimmed = rawYear.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const usageOptions: { value: string; label: string }[] = [
  { value: "__all", label: "All usage types" },
  { value: "WORK", label: "Work" },
  { value: "PRIVATE", label: "Private" },
  { value: "MIXED", label: "Mixed" },
  { value: "OTHER", label: "Other" },
];

const sortOptions: { value: ItemSortMode; label: string }[] = [
  { value: "purchase_date_desc", label: "Purchase date (newest first)" },
  { value: "price_desc", label: "Price (highest first)" },
  { value: "deductible_desc", label: "Deductible impact (highest first)" },
];

export default function ItemsRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    year?: string | string[];
    missingReceipt?: string | string[];
    missingNotes?: string | string[];
  }>();

  const sessionDefaults = useMemo(() => getItemListSessionState(), []);

  const [search, setSearch] = useState(sessionDefaults.search);
  const [year, setYear] = useState(sessionDefaults.year);
  const [categoryId, setCategoryId] = useState<string | null>(sessionDefaults.categoryId);
  const [usageType, setUsageType] = useState<ItemUsageType | null>(sessionDefaults.usageType);
  const [missingReceipt, setMissingReceipt] = useState(sessionDefaults.missingReceipt);
  const [missingNotes, setMissingNotes] = useState(sessionDefaults.missingNotes);
  const [sortMode, setSortMode] = useState<ItemSortMode>(sessionDefaults.sortMode);

  const [allItems, setAllItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const parsedYear = useMemo(() => parseYearInput(year), [year]);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const categorySelectOptions = useMemo(
    () => [
      { value: "__all", label: "All categories" },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories]
  );

  useEffect(() => {
    updateItemListSessionState({
      search,
      year,
      categoryId,
      usageType,
      missingReceipt,
      missingNotes,
      sortMode,
    });
  }, [categoryId, missingNotes, missingReceipt, search, sortMode, usageType, year]);

  useEffect(() => {
    const yearParam = toSingleParam(params.year);
    const missingReceiptParam = toSingleParam(params.missingReceipt);
    const missingNotesParam = toSingleParam(params.missingNotes);

    const hasAnyParam =
      yearParam !== undefined || missingReceiptParam !== undefined || missingNotesParam !== undefined;
    if (!hasAnyParam) {
      return;
    }

    if (yearParam !== undefined) {
      setYear(yearParam);
    }
    if (missingReceiptParam !== undefined) {
      setMissingReceipt(missingReceiptParam === "1");
    }
    if (missingNotesParam !== undefined) {
      setMissingNotes(missingNotesParam === "1");
    }
  }, [params.missingNotes, params.missingReceipt, params.year]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [itemRepository, categoryRepository, profileSettingsRepository] = await Promise.all([
        getItemRepository(),
        getCategoryRepository(),
        getProfileSettingsRepository(),
      ]);

      const baseFilters = {
        year: parsedYear,
        categoryId: categoryId ?? undefined,
        usageType: usageType ?? undefined,
        missingReceipt,
        missingNotes,
      };

      const [loadedItems, loadedCategories, loadedSettings] = await Promise.all([
        itemRepository.list(baseFilters),
        categoryRepository.list(),
        profileSettingsRepository.getSettings(),
      ]);

      setAllItems(loadedItems);
      setCategories(loadedCategories);
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Failed to load items", error);
      setLoadError("Could not load items.");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, missingNotes, missingReceipt, parsedYear, usageType]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const displayedItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    const searched =
      searchTerm.length === 0
        ? allItems
        : allItems.filter((item) => {
            const haystack = `${item.title} ${item.vendor ?? ""}`.toLowerCase();
            return haystack.includes(searchTerm);
          });

    const sorted = [...searched];
    sorted.sort((left, right) => {
      if (sortMode === "price_desc") {
        return right.totalCents - left.totalCents;
      }

      if (sortMode === "deductible_desc" && settings) {
        const targetYear = parsedYear ?? settings.taxYearDefault;
        const rightImpact = computeDeductibleImpactCents(right, settings, categoryMap, targetYear);
        const leftImpact = computeDeductibleImpactCents(left, settings, categoryMap, targetYear);
        if (rightImpact !== leftImpact) {
          return rightImpact - leftImpact;
        }
      }

      if (right.purchaseDate !== left.purchaseDate) {
        return right.purchaseDate.localeCompare(left.purchaseDate);
      }
      return right.createdAt.localeCompare(left.createdAt);
    });

    return sorted;
  }, [allItems, categoryMap, parsedYear, search, settings, sortMode]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    year.trim().length > 0 ||
    categoryId !== null ||
    usageType !== null ||
    missingReceipt ||
    missingNotes ||
    sortMode !== "purchase_date_desc";

  const resetFilters = () => {
    setSearch("");
    setYear("");
    setCategoryId(null);
    setUsageType(null);
    setMissingReceipt(false);
    setMissingNotes(false);
    setSortMode("purchase_date_desc");
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={displayedItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <ThemedText type="title">Items</ThemedText>
            <ThemedText themeColor="textSecondary">
              Search, filter, and sort items for review and export preparation.
            </ThemedText>

            <Card>
              <FormField label="Search (Title/Vendor)">
                <Input value={search} onChangeText={setSearch} placeholder="Search by title or vendor" />
              </FormField>

              <FormField label="Year">
                <Input
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                  placeholder="e.g. 2026"
                  maxLength={4}
                />
              </FormField>

              <FormField label="Category">
                <Select
                  value={categoryId ?? "__all"}
                  options={categorySelectOptions}
                  onChange={(nextValue) => setCategoryId(nextValue === "__all" ? null : nextValue)}
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

              <FormField label="Sort By">
                <Select
                  value={sortMode}
                  options={sortOptions}
                  onChange={(nextValue) => setSortMode(nextValue as ItemSortMode)}
                />
              </FormField>

              <View style={styles.toggleRow}>
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

              <View style={styles.toggleRow}>
                <Button variant="secondary" label="Add Receipt" onPress={() => router.push("/item/new")} />
                <Button
                  variant="ghost"
                  label="Clear Filters"
                  onPress={resetFilters}
                  disabled={!hasActiveFilters}
                />
              </View>
            </Card>

            <View style={styles.metaRow}>
              <Badge text={`${displayedItems.length} result(s)`} />
              {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}
            </View>

            {isLoading && <ActivityIndicator />}
          </View>
        }
        renderItem={({ item }) => {
          const categoryName = item.categoryId ? categoryMap.get(item.categoryId)?.name ?? "Unknown" : "None";
          const deductibleImpact = settings
            ? computeDeductibleImpactCents(
                item,
                settings,
                categoryMap,
                parsedYear ?? settings.taxYearDefault
              )
            : 0;

          return (
            <Card style={styles.itemCard}>
              <ThemedText type="smallBold">{item.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.purchaseDate} | {formatCents(item.totalCents)} | {item.usageType}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Vendor: {item.vendor?.trim() ? item.vendor : "-"} | Category: {categoryName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Deductible impact: {formatCents(deductibleImpact)}
              </ThemedText>
              <View style={styles.row}>
                {!item.notes?.trim() && (item.usageType === "WORK" || item.usageType === "MIXED") && (
                  <Badge text="Missing notes" variant="warning" />
                )}
                <Button
                  variant="secondary"
                  label="Open Detail"
                  onPress={() => router.push(`/item/${item.id}`)}
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
                No entries match your current search/filter settings.
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
    padding: Spacing.four,
    gap: Spacing.three,
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
  },
  headerSection: {
    gap: Spacing.three,
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.two,
    flexWrap: "wrap",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
    flexWrap: "wrap",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    flexWrap: "wrap",
  },
  itemCard: {
    marginBottom: Spacing.two,
  },
  errorText: {
    color: "#B00020",
  },
});
