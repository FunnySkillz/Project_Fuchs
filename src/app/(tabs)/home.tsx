import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonText,
  Card,
  Heading,
  HStack,
  Pressable,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import { getCategoryRepository, getItemRepository } from "@/repositories/create-core-repositories";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { onProfileSettingsSaved } from "@/services/app-events";
import { formatCents } from "@/utils/money";

interface DashboardStats {
  year: number;
  itemCount: number;
  deductibleThisYearCents: number;
  estimatedRefundImpactCents: number;
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
      const [settingsRepo, itemRepo, categoryRepo] = await Promise.all([
        getProfileSettingsRepository(),
        getItemRepository(),
        getCategoryRepository(),
      ]);
      const settings = await settingsRepo.getSettings();
      const year = settings.taxYearDefault;
      const [yearItems, missingReceiptItems, missingNotesItems, categories] = await Promise.all([
        itemRepo.list({ year }),
        itemRepo.list({ year, missingReceipt: true }),
        itemRepo.list({ year, missingNotes: true }),
        categoryRepo.list(),
      ]);

      const categoryMap = new Map(categories.map((category) => [category.id, category]));
      const deductibleThisYearCents = yearItems.reduce((sum, item) => {
        return sum + computeDeductibleImpactCents(item, settings, categoryMap, year);
      }, 0);
      const estimatedRefundImpactCents = Math.round(
        (deductibleThisYearCents * settings.marginalRateBps) / 10_000
      );

      setStats({
        year,
        itemCount: yearItems.length,
        deductibleThisYearCents,
        estimatedRefundImpactCents,
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

  useEffect(() => {
    const unsubscribe = onProfileSettingsSaved(() => {
      void loadDashboard();
    });
    return unsubscribe;
  }, [loadDashboard]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <Box flex={1} px="$5" py="$6" justifyContent="center" alignItems="center">
          <VStack space="md" alignItems="center">
            <Spinner size="large" />
            <Text size="sm">Loading home overview...</Text>
          </VStack>
        </Box>
      </SafeAreaView>
    );
  }

  if (loadError || !stats) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <Box flex={1} px="$5" py="$6">
          <VStack space="lg" maxWidth={760} width="$full" alignSelf="center">
            <Heading size="xl">Steuerausgleich</Heading>
            <Card borderWidth="$1" borderColor="$error300">
              <VStack space="sm">
                <Text bold size="md">
                  Could not load dashboard
                </Text>
                <Text size="sm">{loadError ?? "Unknown error while loading dashboard."}</Text>
              </VStack>
            </Card>
            <Button onPress={() => void loadDashboard()} alignSelf="flex-start">
              <ButtonText>Retry</ButtonText>
            </Button>
          </VStack>
        </Box>
      </SafeAreaView>
    );
  }

  const hasItems = stats.itemCount > 0;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <Box flex={1} px="$5" py="$6">
        <VStack maxWidth={760} width="$full" alignSelf="center" space="lg">
          <VStack space="xs">
            <Heading size="2xl">Steuerausgleich {stats.year}</Heading>
            <Text size="sm">Estimated deductible this year</Text>
          </VStack>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="sm">
              <Text size="sm">Deductible this year</Text>
              <Heading size="3xl">{formatCents(stats.deductibleThisYearCents)}</Heading>
              <Text size="sm">Estimated refund impact: {formatCents(stats.estimatedRefundImpactCents)}</Text>
            </VStack>
          </Card>

          {hasItems ? (
            <HStack space="md" flexWrap="wrap">
              <Pressable
                flex={1}
                minWidth={240}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/items",
                    params: { year: String(stats.year), missingReceipt: "1" },
                  })
                }
                testID="home-missing-receipts-card"
              >
                <Card borderWidth="$1" borderColor="$border200">
                  <VStack space="sm">
                    <Text bold size="md">
                      Missing receipts
                    </Text>
                    <Heading size="2xl">{stats.missingReceiptCount}</Heading>
                    <Badge size="sm" action="warning" variant="solid">
                      <BadgeText>Open filtered items</BadgeText>
                    </Badge>
                  </VStack>
                </Card>
              </Pressable>

              <Pressable
                flex={1}
                minWidth={240}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/items",
                    params: { year: String(stats.year), missingNotes: "1" },
                  })
                }
                testID="home-missing-notes-card"
              >
                <Card borderWidth="$1" borderColor="$border200">
                  <VStack space="sm">
                    <Text bold size="md">
                      Missing notes
                    </Text>
                    <Heading size="2xl">{stats.missingNotesCount}</Heading>
                    <Badge size="sm" action="warning" variant="solid">
                      <BadgeText>Open filtered items</BadgeText>
                    </Badge>
                  </VStack>
                </Card>
              </Pressable>
            </HStack>
          ) : (
            <VStack space="sm">
              <Text bold size="md">
                No items added yet.
              </Text>
              <Text size="sm">Use the center + button to add your first item.</Text>
              <HStack space="md" flexWrap="wrap">
                <Button
                  variant="outline"
                  action="secondary"
                  alignSelf="flex-start"
                  onPress={() => router.push("/(tabs)/items")}
                  testID="home-go-items-empty-cta"
                >
                  <ButtonText>Go to Items</ButtonText>
                </Button>
              </HStack>
            </VStack>
          )}
        </VStack>
      </Box>
    </SafeAreaView>
  );
}
