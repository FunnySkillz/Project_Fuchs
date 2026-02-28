import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { Badge, Button, Card } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { Item } from "@/models/item";
import type { ItemListFilters } from "@/repositories/item-repository";
import { getItemRepository } from "@/repositories/create-core-repositories";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function toSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ItemsRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    year?: string | string[];
    missingReceipt?: string | string[];
    missingNotes?: string | string[];
  }>();

  const filters = useMemo<ItemListFilters>(() => {
    const yearRaw = toSingleParam(params.year);
    const missingReceiptRaw = toSingleParam(params.missingReceipt);
    const missingNotesRaw = toSingleParam(params.missingNotes);
    const parsedYear = yearRaw ? Number.parseInt(yearRaw, 10) : undefined;

    return {
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      missingReceipt: missingReceiptRaw === "1",
      missingNotes: missingNotesRaw === "1",
    };
  }, [params.missingNotes, params.missingReceipt, params.year]);

  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getItemRepository();
      const loaded = await repository.list(filters);
      setItems(loaded);
    } catch (error) {
      console.error("Failed to load items", error);
      setLoadError("Could not load items.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems])
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Items</ThemedText>
        <View style={styles.filterRow}>
          {filters.year !== undefined && <Badge text={`Year: ${filters.year}`} />}
          {filters.missingReceipt && <Badge text="Missing receipt" variant="warning" />}
          {filters.missingNotes && <Badge text="Missing notes" variant="warning" />}
        </View>
        {(filters.year !== undefined || filters.missingReceipt || filters.missingNotes) && (
          <Button
            variant="ghost"
            label="Clear Filters"
            onPress={() => router.replace("/(tabs)/items")}
          />
        )}
        <Button label="Add Receipt" onPress={() => router.push("/item/new")} />

        {isLoading && <ActivityIndicator />}
        {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}

        {!isLoading && !loadError && items.length === 0 && (
          <Card>
            <ThemedText type="smallBold">No items found</ThemedText>
            <ThemedText themeColor="textSecondary">
              No entries match the currently active filters.
            </ThemedText>
          </Card>
        )}

        {!isLoading &&
          !loadError &&
          items.map((item) => (
            <Card key={item.id}>
              <ThemedText type="smallBold">{item.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.purchaseDate} | {formatCents(item.totalCents)} | {item.usageType}
              </ThemedText>
              <Button
                variant="secondary"
                label="Open Detail"
                onPress={() => router.push(`/item/${item.id}`)}
              />
            </Card>
          ))}
      </ScrollView>
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
    maxWidth: 720,
    alignSelf: "center",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  errorText: {
    color: "#B00020",
  },
});
