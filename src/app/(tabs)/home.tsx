import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Badge, Button, Card } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import type { Category } from "@/models/category";
import type { ProfileSettings } from "@/models/profile-settings";
import { getCategoryRepository, getItemRepository } from "@/repositories/create-core-repositories";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { formatCents } from "@/utils/money";

interface DashboardStats {
  year: number;
  deductibleYtdCents: number;
  missingReceiptCount: number;
  missingNotesCount: number;
}

export default function HomeRoute() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const year = new Date().getFullYear();
      const [settingsRepo, itemRepo, categoryRepo] = await Promise.all([
        getProfileSettingsRepository(),
        getItemRepository(),
        getCategoryRepository(),
      ]);
      const [settings, yearItems, missingReceiptItems, missingNotesItems, categories] = await Promise.all([
        settingsRepo.getSettings(),
        itemRepo.list({ year }),
        itemRepo.list({ year, missingReceipt: true }),
        itemRepo.list({ year, missingNotes: true }),
        categoryRepo.list(),
      ]);

      const categoryMap = new Map(categories.map((category) => [category.id, category]));
      const deductibleYtdCents = yearItems.reduce((sum, item) => {
        return sum + computeDeductibleImpactCents(item, settings, categoryMap, year);
      }, 0);

      setStats({
        year,
        deductibleYtdCents,
        missingReceiptCount: missingReceiptItems.length,
        missingNotesCount: missingNotesItems.length,
      });
    } catch (error) {
      console.error("Failed to load dashboard data", error);
      setLoadError("Could not load dashboard metrics.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title">Home</ThemedText>
        <ThemedText themeColor="textSecondary">Quick overview for your current tax year.</ThemedText>

        {isLoading && <ActivityIndicator />}
        {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}

        {stats && (
          <>
            <Card>
              <ThemedText type="smallBold">Year-to-Date Deductible ({stats.year})</ThemedText>
              <ThemedText type="subtitle">{formatCents(stats.deductibleYtdCents)}</ThemedText>
            </Card>

            <Button label="Add Receipt" onPress={() => router.push("/item/new")} />

            <Card>
              <ThemedText type="smallBold">Attention Flags</ThemedText>
              <View style={styles.flagRow}>
                <Badge text={`${stats.missingReceiptCount} missing receipt`} variant="warning" />
                <Button
                  variant="secondary"
                  label="Open Filter"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/items",
                      params: { year: String(stats.year), missingReceipt: "1" },
                    })
                  }
                />
              </View>
              <View style={styles.flagRow}>
                <Badge text={`${stats.missingNotesCount} missing notes`} variant="warning" />
                <Button
                  variant="secondary"
                  label="Open Filter"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/items",
                      params: { year: String(stats.year), missingNotes: "1" },
                    })
                  }
                />
              </View>
            </Card>
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: Spacing.three,
    padding: Spacing.four,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  flagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  errorText: {
    color: "#B00020",
  },
});
