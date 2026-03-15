import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, FileText, Receipt } from "lucide-react-native";
import {
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
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
  const colorScheme = useColorScheme();
  const isNavigatingToItemsRef = React.useRef(false);
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
      isNavigatingToItemsRef.current = false;
      void loadDashboard();
    }, [loadDashboard])
  );

  useEffect(() => {
    const unsubscribe = onProfileSettingsSaved(() => {
      void loadDashboard();
    });
    return unsubscribe;
  }, [loadDashboard]);

  const navigateToItemsWithFilter = useCallback(
    (params: { missingReceipt?: "1"; missingNotes?: "1" }) => {
      if (!stats || isNavigatingToItemsRef.current) {
        return;
      }
      isNavigatingToItemsRef.current = true;
      router.push({
        pathname: "/(tabs)/items",
        params: { year: String(stats.year), ...params },
      });
    },
    [router, stats]
  );

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
  const hasMissingReceipt = stats.missingReceiptCount > 0;
  const hasMissingNotes = stats.missingNotesCount > 0;
  const hasAttentionItems = hasMissingReceipt || hasMissingNotes;

  const formatCountLabel = (count: number) => `${count} item${count === 1 ? "" : "s"}`;
  const isDarkMode = colorScheme === "dark";
  const secondaryTextColor = isDarkMode ? Colors.dark.textSecondary : Colors.light.textSecondary;
  const cardBackgroundColor = isDarkMode ? Colors.dark.backgroundElement : Colors.light.backgroundElement;
  const warningIconColor = isDarkMode ? Colors.dark.warning : Colors.light.warning;
  const warningActionTextColor = isDarkMode ? Colors.dark.warningText : Colors.light.warningText;
  const warningActionBackground = isDarkMode
    ? Colors.dark.warningBackground
    : Colors.light.warningBackground;

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
              <Text size="sm">Estimated deductible this year</Text>
              <Heading size="3xl">{formatCents(stats.deductibleThisYearCents)}</Heading>
              <Text size="sm">
                Estimated tax refund impact: {formatCents(stats.estimatedRefundImpactCents)}
              </Text>
            </VStack>
          </Card>

          {hasItems ? (
            <VStack space="sm">
              <Heading size="md">Attention needed</Heading>
              {hasAttentionItems ? (
                <VStack space="sm">
                  {hasMissingReceipt && (
                    <Card
                      borderWidth="$1"
                      borderColor="$border200"
                      testID="home-missing-receipts-card"
                      style={{ backgroundColor: cardBackgroundColor }}
                    >
                      <VStack space="sm">
                        <HStack alignItems="center" justifyContent="space-between" space="sm">
                          <HStack alignItems="center" space="sm" flex={1}>
                            <Receipt size={18} color={warningIconColor} />
                            <VStack space="xs" flex={1}>
                              <Text bold size="sm">
                                Missing receipts
                              </Text>
                              <Text size="xs" color={secondaryTextColor}>
                                {formatCountLabel(stats.missingReceiptCount)}
                              </Text>
                            </VStack>
                          </HStack>
                          <Text size="xs" color={secondaryTextColor}>
                            {formatCountLabel(stats.missingReceiptCount)}
                          </Text>
                        </HStack>

                        <Pressable
                          onPress={() => navigateToItemsWithFilter({ missingReceipt: "1" })}
                          testID="home-missing-receipts-row"
                          style={{
                            borderRadius: 10,
                            backgroundColor: warningActionBackground,
                          }}
                        >
                          <HStack
                            px="$3"
                            py="$2"
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Text size="sm" color={warningActionTextColor}>
                              Review items
                            </Text>
                            <ChevronRight size={14} color={warningActionTextColor} />
                          </HStack>
                        </Pressable>
                      </VStack>
                    </Card>
                  )}

                  {hasMissingNotes && (
                    <Card
                      borderWidth="$1"
                      borderColor="$border200"
                      testID="home-missing-notes-card"
                      style={{ backgroundColor: cardBackgroundColor }}
                    >
                      <VStack space="sm">
                        <HStack alignItems="center" justifyContent="space-between" space="sm">
                          <HStack alignItems="center" space="sm" flex={1}>
                            <FileText size={18} color={warningIconColor} />
                            <VStack space="xs" flex={1}>
                              <Text bold size="sm">
                                Missing notes
                              </Text>
                              <Text size="xs" color={secondaryTextColor}>
                                {formatCountLabel(stats.missingNotesCount)}
                              </Text>
                            </VStack>
                          </HStack>
                          <Text size="xs" color={secondaryTextColor}>
                            {formatCountLabel(stats.missingNotesCount)}
                          </Text>
                        </HStack>

                        <Pressable
                          onPress={() => navigateToItemsWithFilter({ missingNotes: "1" })}
                          testID="home-missing-notes-row"
                          style={{
                            borderRadius: 10,
                            backgroundColor: warningActionBackground,
                          }}
                        >
                          <HStack
                            px="$3"
                            py="$2"
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Text size="sm" color={warningActionTextColor}>
                              Add missing notes
                            </Text>
                            <ChevronRight size={14} color={warningActionTextColor} />
                          </HStack>
                        </Pressable>
                      </VStack>
                    </Card>
                  )}
                </VStack>
              ) : (
                <Text size="sm" color={secondaryTextColor}>
                  Everything looks good.
                </Text>
              )}
            </VStack>
          ) : (
            <VStack space="sm">
              <Text bold size="md">
                No items added yet.
              </Text>
              <Text size="sm">Use the center + button to add your first item.</Text>
            </VStack>
          )}
        </VStack>
      </Box>
    </SafeAreaView>
  );
}
