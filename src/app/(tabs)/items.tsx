import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Animated, FlatList, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { Trash2 } from "lucide-react-native";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
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
  Pressable,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { useTheme } from "@/hooks/use-theme";
import { computeDeductibleImpactCents } from "@/domain/deductible-impact";
import type { Category } from "@/models/category";
import type { Item, ItemUsageType } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import {
  getAttachmentRepository,
  getCategoryRepository,
  getItemRepository,
} from "@/repositories/create-core-repositories";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import {
  getItemListSessionState,
  updateItemListSessionState,
  type ItemSortMode,
} from "@/services/item-list-session";
import { deleteItemWithAttachments } from "@/services/item-service";
import { formatCents } from "@/utils/money";

type FilterSheetKind = "year" | "usageType" | "category" | null;

const usageTypeOptions: { label: string; value: ItemUsageType | null }[] = [
  { label: "All usage types", value: null },
  { label: "WORK", value: "WORK" },
  { label: "PRIVATE", value: "PRIVATE" },
  { label: "MIXED", value: "MIXED" },
  { label: "OTHER", value: "OTHER" },
];

const IOS_DELETE_RED = "#FF3B30";
const DELETE_ACTION_WIDTH = 92;
const FULL_SWIPE_TRIGGER_RATIO = 0.85;
const ROW_BORDER_RADIUS = 16;

interface DeleteSwipeActionProps {
  item: Item;
  isDeleting: boolean;
  textOnDeleteColor: string;
  onDeletePress: (item: Item) => void;
  onFullSwipeArmChange: (isArmed: boolean) => void;
  dragX?: Animated.AnimatedInterpolation<number>;
}

function DeleteSwipeAction({
  item,
  isDeleting,
  textOnDeleteColor,
  onDeletePress,
  onFullSwipeArmChange,
  dragX,
}: DeleteSwipeActionProps) {
  const contentTranslateX = useMemo(() => {
    if (dragX && typeof dragX.interpolate === "function") {
      return dragX.interpolate({
        inputRange: [-DELETE_ACTION_WIDTH, 0],
        outputRange: [0, 14],
        extrapolate: "clamp",
      });
    }
    return new Animated.Value(0);
  }, [dragX]);

  useEffect(() => {
    if (!dragX) {
      onFullSwipeArmChange(false);
      return;
    }

    const dragValue = dragX as {
      addListener?: (callback: ({ value }: { value: number }) => void) => string | number;
      removeListener?: (id: string | number) => void;
    };
    if (typeof dragValue.addListener !== "function") {
      return;
    }

    const threshold = -DELETE_ACTION_WIDTH * FULL_SWIPE_TRIGGER_RATIO;
    const listenerId = dragValue.addListener(({ value }: { value: number }) => {
      onFullSwipeArmChange(value <= threshold);
    });

    return () => {
      if (typeof dragValue.removeListener === "function") {
        dragValue.removeListener(listenerId);
      }
      onFullSwipeArmChange(false);
    };
  }, [dragX, onFullSwipeArmChange]);

  return (
    <Animated.View style={styles.deleteActionContainer}>
      <Animated.View style={[styles.deleteActionContent, { transform: [{ translateX: contentTranslateX }] }]}>
        <Pressable
          onPress={() => onDeletePress(item)}
          testID={`items-delete-action-${item.id}`}
          accessibilityLabel={`Delete ${item.title}`}
          accessibilityRole="button"
          disabled={isDeleting}
          style={styles.deleteActionPressable}
        >
          <Trash2 color={textOnDeleteColor} size={16} strokeWidth={2} />
          <Text size="xs" bold style={{ color: textOnDeleteColor }}>
            Delete
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

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

function missingNotesForItem(item: Item): boolean {
  return (item.usageType === "WORK" || item.usageType === "MIXED") && !item.notes?.trim();
}

export default function ItemsRoute() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
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
  const [sortMode] = useState<ItemSortMode>(sessionDefaults.sortMode);

  const [activeSheet, setActiveSheet] = useState<FilterSheetKind>(null);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [missingReceiptItemIds, setMissingReceiptItemIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteCandidateItem, setDeleteCandidateItem] = useState<Item | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const hasMountedFiltersRef = useRef(false);

  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const openedSwipeableIdRef = useRef<string | null>(null);
  const fullSwipeArmedByItemIdRef = useRef<Map<string, boolean>>(new Map());

  const parsedYear = useMemo(() => parseYearInput(year), [year]);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const targetYear = parsedYear ?? settings?.taxYearDefault ?? new Date().getFullYear();

  const deductibleImpactByItemId = useMemo(() => {
    if (!settings) {
      return new Map<string, number>();
    }

    return new Map(
      allItems.map((item) => [
        item.id,
        computeDeductibleImpactCents(item, settings, categoryMap, targetYear),
      ])
    );
  }, [allItems, categoryMap, settings, targetYear]);

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
    if (missingReceiptParam !== undefined || missingNotesParam !== undefined) {
      setMissingReceipt(missingReceiptParam === "1");
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

      const [loadedItems, allUnfilteredItems, loadedCategories, loadedSettings, missingReceiptIds] =
        await Promise.all([
          itemRepository.list(baseFilters),
          itemRepository.list(),
          categoryRepository.list(),
          profileSettingsRepository.getSettings(),
          itemRepository.listMissingReceiptItemIds({
            year: parsedYear,
            categoryId: categoryId ?? undefined,
            usageType: usageType ?? undefined,
            missingNotes,
          }),
        ]);

      const discoveredYears = new Set<number>([loadedSettings.taxYearDefault]);
      for (const item of allUnfilteredItems) {
        const itemYear = Number.parseInt(item.purchaseDate.slice(0, 4), 10);
        if (Number.isFinite(itemYear)) {
          discoveredYears.add(itemYear);
        }
      }

      setAllItems(loadedItems);
      setCategories(loadedCategories);
      setSettings(loadedSettings);
      setMissingReceiptItemIds(new Set(missingReceiptIds));
      setAvailableYears(Array.from(discoveredYears).sort((left, right) => right - left));
    } catch (error) {
      console.error("Failed to load items list", error);
      setAllItems([]);
      setMissingReceiptItemIds(new Set());
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

  useEffect(() => {
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      return;
    }
    void loadData();
  }, [loadData]);

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
    if (sortMode === "price_desc") {
      sorted.sort((left, right) => right.totalCents - left.totalCents);
      return sorted;
    }
    if (sortMode === "deductible_desc") {
      sorted.sort((left, right) => {
        const rightImpact = deductibleImpactByItemId.get(right.id) ?? 0;
        const leftImpact = deductibleImpactByItemId.get(left.id) ?? 0;
        if (rightImpact !== leftImpact) {
          return rightImpact - leftImpact;
        }
        return right.purchaseDate.localeCompare(left.purchaseDate);
      });
      return sorted;
    }

    sorted.sort((left, right) => {
      if (right.purchaseDate !== left.purchaseDate) {
        return right.purchaseDate.localeCompare(left.purchaseDate);
      }
      return right.createdAt.localeCompare(left.createdAt);
    });
    return sorted;
  }, [allItems, deductibleImpactByItemId, search, sortMode]);

  const yearChipLabel = parsedYear ? `Year: ${parsedYear}` : "Year: All";
  const usageTypeChipLabel = usageType ? `Usage: ${usageType}` : "Usage: All";
  const categoryChipLabel = categoryId
    ? `Category: ${categoryMap.get(categoryId)?.name ?? "Unknown"}`
    : "Category: All";

  const rowPriceAndDate = (item: Item) => {
    const categoryName = item.categoryId ? categoryMap.get(item.categoryId)?.name ?? "Unknown" : "No category";
    return `${categoryName} • ${item.purchaseDate}`;
  };
  const listBottomPadding = tabBarHeight + insets.bottom + 24;

  const closeOpenedSwipeable = useCallback(() => {
    if (!openedSwipeableIdRef.current) {
      return;
    }

    const openedRef = swipeableRefs.current.get(openedSwipeableIdRef.current);
    openedRef?.close();
    openedSwipeableIdRef.current = null;
  }, []);

  const handleSwipeableWillOpen = useCallback((itemId: string) => {
    const currentlyOpenItemId = openedSwipeableIdRef.current;
    if (currentlyOpenItemId && currentlyOpenItemId !== itemId) {
      const currentlyOpenSwipeable = swipeableRefs.current.get(currentlyOpenItemId);
      currentlyOpenSwipeable?.close();
    }
    openedSwipeableIdRef.current = itemId;
  }, []);

  const handleSwipeableWillClose = useCallback((itemId: string) => {
    if (openedSwipeableIdRef.current === itemId) {
      openedSwipeableIdRef.current = null;
    }
    fullSwipeArmedByItemIdRef.current.delete(itemId);
  }, []);

  const performDelete = useCallback(
    async (item: Item) => {
      if (isDeletingItem) {
        return;
      }

      setIsDeletingItem(true);
      closeOpenedSwipeable();
      setLoadError(null);

      setAllItems((current) => current.filter((entry) => entry.id !== item.id));
      setMissingReceiptItemIds((current) => {
        if (!current.has(item.id)) {
          return current;
        }
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });

      try {
        await deleteItemWithAttachments(item.id);
        void loadData();
      } catch (error) {
        console.error("Failed to delete item from list", error);
        setLoadError("Could not delete item.");
        void loadData();
      } finally {
        setIsDeletingItem(false);
      }
    },
    [closeOpenedSwipeable, isDeletingItem, loadData]
  );

  const requestDelete = useCallback(
    async (item: Item) => {
      if (isDeletingItem) {
        return;
      }
      closeOpenedSwipeable();

      try {
        const attachmentRepository = await getAttachmentRepository();
        const linkedAttachments = await attachmentRepository.listByItem(item.id);

        if (linkedAttachments.length > 0) {
          setDeleteCandidateItem(item);
          return;
        }

        await performDelete(item);
      } catch (error) {
        console.error("Failed to inspect attachments before item delete", error);
        setLoadError("Could not delete item.");
      }
    },
    [closeOpenedSwipeable, isDeletingItem, performDelete]
  );

  const confirmDeleteCandidate = useCallback(() => {
    if (!deleteCandidateItem) {
      return;
    }
    const selectedItem = deleteCandidateItem;
    setDeleteCandidateItem(null);
    void performDelete(selectedItem);
  }, [deleteCandidateItem, performDelete]);

  const handleSwipeableOpen = useCallback(
    (item: Item, direction: "left" | "right") => {
      if (direction !== "right") {
        return;
      }

      if (!fullSwipeArmedByItemIdRef.current.get(item.id)) {
        return;
      }

      fullSwipeArmedByItemIdRef.current.set(item.id, false);
      void requestDelete(item);
    },
    [requestDelete]
  );

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
      item: Item
    ) => (
      <DeleteSwipeAction
        item={item}
        isDeleting={isDeletingItem}
        textOnDeleteColor={theme.textOnPrimary}
        onDeletePress={(selectedItem) => {
          void requestDelete(selectedItem);
        }}
        onFullSwipeArmChange={(isArmed) => {
          fullSwipeArmedByItemIdRef.current.set(item.id, isArmed);
        }}
        dragX={dragX}
      />
    ),
    [isDeletingItem, requestDelete, theme.textOnPrimary]
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Box flex={1} px="$5" py="$6">
          <FlatList
            data={displayedItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: listBottomPadding }}
            ListHeaderComponent={
              <VStack space="lg" maxWidth={900} width="$full" alignSelf="center" pb="$4">
                <VStack space="xs">
                  <Heading size="2xl">Items</Heading>
                  <Text size="sm">Search, filter and review deductible impact by item.</Text>
                </VStack>

                <Input variant="outline" size="md">
                  <InputField
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search title or vendor"
                    testID="items-search-input"
                  />
                </Input>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <HStack space="sm" alignItems="center" pr="$2">
                    <Button
                      size="sm"
                      variant={parsedYear ? "solid" : "outline"}
                      action={parsedYear ? "primary" : "secondary"}
                      onPress={() => setActiveSheet("year")}
                      testID="items-filter-year"
                    >
                      <ButtonText>{yearChipLabel}</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant={usageType ? "solid" : "outline"}
                      action={usageType ? "primary" : "secondary"}
                      onPress={() => setActiveSheet("usageType")}
                      testID="items-filter-usage"
                    >
                      <ButtonText>{usageTypeChipLabel}</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant={missingReceipt ? "solid" : "outline"}
                      action={missingReceipt ? "primary" : "secondary"}
                      onPress={() => setMissingReceipt((current) => !current)}
                      testID="items-filter-missing-receipt"
                    >
                      <ButtonText>Missing receipt</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant={missingNotes ? "solid" : "outline"}
                      action={missingNotes ? "primary" : "secondary"}
                      onPress={() => setMissingNotes((current) => !current)}
                      testID="items-filter-missing-notes"
                    >
                      <ButtonText>Missing notes</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant={categoryId ? "solid" : "outline"}
                      action={categoryId ? "primary" : "secondary"}
                      onPress={() => setActiveSheet("category")}
                      testID="items-filter-category"
                    >
                      <ButtonText>{categoryChipLabel}</ButtonText>
                    </Button>
                  </HStack>
                </ScrollView>
              </VStack>
            }
            ListEmptyComponent={
              <VStack maxWidth={900} width="$full" alignSelf="center" space="md">
                {isLoading ? (
                  <Card borderWidth="$1" borderColor="$border200">
                    <HStack space="sm" alignItems="center">
                      <Spinner size="small" />
                      <Text>Loading items...</Text>
                    </HStack>
                  </Card>
                ) : loadError ? (
                  <Card borderWidth="$1" borderColor="$error300">
                    <VStack space="sm">
                      <Text bold size="md">
                        Could not load items
                      </Text>
                      <Text size="sm">{loadError}</Text>
                      <Button onPress={() => void loadData()} alignSelf="flex-start">
                        <ButtonText>Retry</ButtonText>
                      </Button>
                    </VStack>
                  </Card>
                ) : (
                  <Card borderWidth="$1" borderColor="$border200">
                    <Text size="sm">No items found. Adjust filters or add a new item.</Text>
                  </Card>
                )}
              </VStack>
            }
            renderItem={({ item }) => {
              const deductibleImpact = deductibleImpactByItemId.get(item.id) ?? 0;
              const hasMissingReceipt = missingReceiptItemIds.has(item.id);
              const hasMissingNotes = missingNotesForItem(item);

              return (
                <View style={styles.rowContainer}>
                  <Swipeable
                    ref={(node) => {
                      swipeableRefs.current.set(item.id, node);
                    }}
                    friction={2}
                    overshootRight={false}
                    overshootFriction={8}
                    rightThreshold={Math.round(DELETE_ACTION_WIDTH * 0.55)}
                    testID={`items-swipeable-${item.id}`}
                    onSwipeableWillOpen={() => handleSwipeableWillOpen(item.id)}
                    onSwipeableWillClose={() => handleSwipeableWillClose(item.id)}
                    onSwipeableOpen={(direction) => handleSwipeableOpen(item, direction)}
                    renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
                  >
                    <Pressable
                      onPress={() => router.push(`/item/${item.id}`)}
                      testID={`items-row-${item.id}`}
                      style={styles.rowPressable}
                    >
                      <Card borderWidth="$1" borderColor="$border200" style={styles.rowCard}>
                        <VStack space="sm">
                          <HStack alignItems="flex-start" justifyContent="space-between" space="md">
                            <Text bold size="md" flex={1}>
                              {item.title}
                            </Text>
                            <Text bold size="md">
                              {formatCents(item.totalCents)}
                            </Text>
                          </HStack>

                          <Text size="sm">{rowPriceAndDate(item)}</Text>
                          <Text size="sm">Deductible this year: {formatCents(deductibleImpact)}</Text>

                          <HStack space="sm" flexWrap="wrap">
                            {hasMissingReceipt && (
                              <Badge size="sm" action="warning" variant="outline">
                                <BadgeText>Missing receipt</BadgeText>
                              </Badge>
                            )}
                            {hasMissingNotes && (
                              <Badge size="sm" action="warning" variant="outline">
                                <BadgeText>Missing notes</BadgeText>
                              </Badge>
                            )}
                          </HStack>
                        </VStack>
                      </Card>
                    </Pressable>
                  </Swipeable>
                </View>
              );
            }}
          />

          <Actionsheet isOpen={activeSheet !== null} onClose={() => setActiveSheet(null)}>
            <ActionsheetBackdrop />
            <ActionsheetContent>
              <ActionsheetDragIndicatorWrapper>
                <ActionsheetDragIndicator />
              </ActionsheetDragIndicatorWrapper>

              {activeSheet === "year" && (
                <>
                  <ActionsheetItem
                    onPress={() => {
                      setYear("");
                      setActiveSheet(null);
                    }}
                  >
                    <ActionsheetItemText>All years</ActionsheetItemText>
                  </ActionsheetItem>
                  {availableYears.map((optionYear) => (
                    <ActionsheetItem
                      key={optionYear}
                      onPress={() => {
                        setYear(String(optionYear));
                        setActiveSheet(null);
                      }}
                    >
                      <ActionsheetItemText>{optionYear}</ActionsheetItemText>
                    </ActionsheetItem>
                  ))}
                </>
              )}

              {activeSheet === "usageType" &&
                usageTypeOptions.map((option) => (
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

          <AlertDialog
            isOpen={deleteCandidateItem !== null}
            onClose={() => setDeleteCandidateItem(null)}
            testID="items-delete-confirm-modal"
          >
            <AlertDialogBackdrop />
            <AlertDialogContent>
              <AlertDialogHeader>
                <Heading size="md">Delete item?</Heading>
              </AlertDialogHeader>
              <AlertDialogBody>
                <Text size="sm">This will delete the item and its attachments from this device.</Text>
              </AlertDialogBody>
              <AlertDialogFooter>
                <HStack space="sm">
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => setDeleteCandidateItem(null)}
                    testID="items-delete-confirm-cancel"
                  >
                    <ButtonText>Cancel</ButtonText>
                  </Button>
                  <Button
                    action="negative"
                    onPress={confirmDeleteCandidate}
                    disabled={isDeletingItem}
                    testID="items-delete-confirm-delete"
                  >
                    <ButtonText>{isDeletingItem ? "Deleting..." : "Delete"}</ButtonText>
                  </Button>
                </HStack>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Box>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    marginBottom: 12,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
    borderRadius: ROW_BORDER_RADIUS,
    overflow: "hidden",
  },
  rowPressable: {
    width: "100%",
  },
  rowCard: {
    borderRadius: ROW_BORDER_RADIUS,
    minHeight: 116,
  },
  deleteActionContainer: {
    backgroundColor: IOS_DELETE_RED,
    width: DELETE_ACTION_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "stretch",
  },
  deleteActionContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteActionPressable: {
    flex: 1,
    minHeight: 44,
    minWidth: 88,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
  },
});
