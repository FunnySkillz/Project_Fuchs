import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { HeaderBackButton } from "@react-navigation/elements";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable as RNPressable, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pencil, Trash2 } from "lucide-react-native";
import {
  AlertDialog as GAlertDialog,
  AlertDialogBackdrop as GAlertDialogBackdrop,
  AlertDialogBody as GAlertDialogBody,
  AlertDialogContent as GAlertDialogContent,
  AlertDialogFooter as GAlertDialogFooter,
  AlertDialogHeader as GAlertDialogHeader,
  Badge as GBadge,
  BadgeText as GBadgeText,
  Box as GBox,
  Button as GButton,
  ButtonText as GButtonText,
  Card as GCard,
  Heading as GHeading,
  HStack as GHStack,
  Modal as GModal,
  ModalBackdrop as GModalBackdrop,
  ModalBody as GModalBody,
  ModalContent as GModalContent,
  Pressable as GPressable,
  Spinner as GSpinner,
  Text as GText,
  VStack as GVStack,
} from "@gluestack-ui/themed";

import { estimateTaxImpact } from "@/domain/calculation-engine";
import { resolveWorkPercent } from "@/domain/work-percent";
import { useTheme } from "@/hooks/use-theme";
import type { Attachment } from "@/models/attachment";
import type { Category } from "@/models/category";
import type { Item } from "@/models/item";
import type { ProfileSettings } from "@/models/profile-settings";
import {
  getAttachmentRepository,
  getCategoryRepository,
  getItemRepository,
} from "@/repositories/create-core-repositories";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { attachmentFileExists, resolveAttachmentPreviewUri } from "@/services/attachment-storage";
import { friendlyFileErrorMessage } from "@/services/friendly-errors";
import { deleteItemWithAttachments } from "@/services/item-service";
import { addMonthsToYmd } from "@/utils/date";
import { formatCents } from "@/utils/money";

function toSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isImageAttachment(attachment: Attachment): boolean {
  return attachment.mimeType.startsWith("image/");
}

function computeWarrantyUntilDate(purchaseDate: string, warrantyMonths: number | null): string | null {
  if (!warrantyMonths || warrantyMonths <= 0) {
    return null;
  }
  return addMonthsToYmd(purchaseDate, warrantyMonths);
}

function resolveUsefulLifeMonths(item: Item, categoryMap: Map<string, Category>): number {
  if (item.usefulLifeMonthsOverride && item.usefulLifeMonthsOverride > 0) {
    return item.usefulLifeMonthsOverride;
  }

  if (item.categoryId) {
    const category = categoryMap.get(item.categoryId);
    if (category?.defaultUsefulLifeMonths && category.defaultUsefulLifeMonths > 0) {
      return category.defaultUsefulLifeMonths;
    }
  }

  return 36;
}

function resolveCalculationWorkPercent(item: Item, defaultWorkPercent: number): number {
  if (
    item.usageType === "MIXED" &&
    (item.workPercent === null || item.workPercent === undefined || !Number.isFinite(item.workPercent))
  ) {
    return Math.max(0, Math.min(100, defaultWorkPercent));
  }
  return resolveWorkPercent(item.usageType, item.workPercent);
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <GHStack justifyContent="space-between" alignItems="center" space="md">
      <GText size="sm">{label}</GText>
      <GText size="sm" bold textAlign="right" flex={1}>
        {value}
      </GText>
    </GHStack>
  );
}

export default function ItemDetailRoute() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = toSingleParam(params.id);
  const canGoBack =
    typeof navigation.canGoBack === "function"
      ? navigation.canGoBack()
      : typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

  const [item, setItem] = useState<Item | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [missingAttachmentIds, setMissingAttachmentIds] = useState<Set<string>>(new Set());
  const [attachmentPreviewUris, setAttachmentPreviewUris] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const isNavigatingToEditRef = useRef(false);

  const handleBackPress = useCallback(() => {
    if (typeof navigation.canGoBack === "function" && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    const routerWithBack = router as {
      canGoBack?: () => boolean;
      back?: () => void;
    };
    if (typeof routerWithBack.canGoBack === "function" && routerWithBack.canGoBack()) {
      routerWithBack.back?.();
      return;
    }

    router.replace("/(tabs)/items");
  }, [navigation, router]);

  const renderHeaderBackButton = useCallback(
    (props: { canGoBack?: boolean; tintColor?: string }) =>
      props.canGoBack ? (
        <HeaderBackButton
          testID="itemdetail-header-back"
          tintColor={props.tintColor}
          displayMode="minimal"
          onPress={handleBackPress}
        />
      ) : null,
    [handleBackPress]
  );

  const loadItem = useCallback(async () => {
    if (!itemId) {
      setLoadError("Missing item id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [itemRepository, attachmentRepository, categoryRepository, profileSettingsRepository] =
        await Promise.all([
          getItemRepository(),
          getAttachmentRepository(),
          getCategoryRepository(),
          getProfileSettingsRepository(),
        ]);

      const [loadedItem, loadedAttachments, loadedCategories, loadedSettings] = await Promise.all([
        itemRepository.getById(itemId),
        attachmentRepository.listByItem(itemId),
        categoryRepository.list(),
        profileSettingsRepository.getSettings(),
      ]);

      if (!loadedItem) {
        setLoadError("Item not found.");
        setItem(null);
      } else {
        setItem(loadedItem);
      }

      setAttachments(loadedAttachments);
      const checks = await Promise.all(
        loadedAttachments.map(async (attachment) => ({
          id: attachment.id,
          exists: await attachmentFileExists(attachment.filePath),
          previewUri: await resolveAttachmentPreviewUri(attachment.filePath, attachment.mimeType),
        }))
      );
      setMissingAttachmentIds(
        new Set(checks.filter((entry) => !entry.exists).map((entry) => entry.id))
      );
      setAttachmentPreviewUris(
        Object.fromEntries(checks.map((entry) => [entry.id, entry.previewUri]))
      );
      setCategories(loadedCategories);
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Failed to load item detail", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not load item details."));
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useFocusEffect(
    useCallback(() => {
      isNavigatingToEditRef.current = false;
      void loadItem();
    }, [loadItem])
  );

  const handleEditPress = useCallback(() => {
    if (!item || isNavigatingToEditRef.current) {
      return;
    }
    isNavigatingToEditRef.current = true;
    router.push(`/item/${item.id}/edit`);
  }, [item, router]);

  React.useEffect(() => {
    const navigationWithOptions = navigation as {
      setOptions?: (options: {
        headerLeft?: (props: { canGoBack?: boolean; tintColor?: string }) => React.ReactNode;
        headerRight?: () => React.ReactNode;
      }) => void;
    };
    if (typeof navigationWithOptions.setOptions !== "function") {
      return;
    }

    if (!item) {
      navigationWithOptions.setOptions({
        headerLeft: renderHeaderBackButton,
        headerRight: undefined,
      });
      return;
    }

    navigationWithOptions.setOptions({
      headerLeft: renderHeaderBackButton,
      headerRight: () => (
        <RNPressable
          onPress={handleEditPress}
          accessibilityRole="button"
          accessibilityLabel="Edit item"
          hitSlop={8}
          testID="item-detail-header-edit"
          style={({ pressed }) => ({
            paddingHorizontal: 8,
            paddingVertical: 4,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Pencil size={18} strokeWidth={2} color={theme.primary} />
        </RNPressable>
      ),
    });
  }, [handleEditPress, item, navigation, renderHeaderBackButton, theme.primary]);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const categoryName = item?.categoryId ? categoryMap.get(item.categoryId)?.name ?? "Unknown" : "None";
  const warrantyUntilDate = item ? computeWarrantyUntilDate(item.purchaseDate, item.warrantyMonths) : null;
  const selectedAttachmentMissing = selectedAttachment
    ? missingAttachmentIds.has(selectedAttachment.id)
    : false;
  const infoWorkPercent = item ? resolveWorkPercent(item.usageType, item.workPercent) : 0;

  const calculationBreakdown = useMemo(() => {
    if (!item || !settings) {
      return null;
    }

    const effectiveWorkPercent = resolveCalculationWorkPercent(item, settings.defaultWorkPercent);
    const workRelevantCents = Math.round((item.totalCents * effectiveWorkPercent) / 100);
    const usefulLifeMonths = resolveUsefulLifeMonths(item, categoryMap);
    const estimate = estimateTaxImpact(
      {
        totalCents: item.totalCents,
        usageType: item.usageType,
        workPercent: item.workPercent,
        purchaseDate: item.purchaseDate,
        usefulLifeMonths,
      },
      {
        gwgThresholdCents: settings.gwgThresholdCents,
        applyHalfYearRule: settings.applyHalfYearRule,
        marginalRateBps: settings.marginalRateBps,
        defaultWorkPercent: settings.defaultWorkPercent,
      },
      settings.taxYearDefault
    );

    return {
      workRelevantCents,
      deductibleThisYearCents: estimate.deductibleThisYearCents,
      estimatedRefundCents: estimate.estimatedRefundThisYearCents,
      scheduleByYear: estimate.scheduleByYear,
    };
  }, [categoryMap, item, settings]);

  const handleDelete = async () => {
    if (!itemId || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteItemWithAttachments(itemId);
      router.replace("/(tabs)/items");
    } catch (error) {
      console.error("Failed to delete item", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not delete item."));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <GBox flex={1} px="$5" py="$6" alignItems="center" justifyContent="center">
          <GVStack space="md" alignItems="center">
            <GSpinner size="large" />
            <GText size="sm">Loading item details...</GText>
          </GVStack>
        </GBox>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <GBox flex={1} px="$5" py="$6">
          <GVStack maxWidth={860} width="$full" alignSelf="center" space="lg">
            <GHeading size="xl">Item Detail</GHeading>
            <GCard borderWidth="$1" borderColor="$error300">
              <GVStack space="sm">
                <GText bold size="md">
                  Could not load item
                </GText>
                <GText size="sm">{loadError ?? "Item not found."}</GText>
              </GVStack>
            </GCard>
            <GButton variant="outline" action="secondary" onPress={() => router.replace("/(tabs)/items")}>
              <GButtonText>Back to Items</GButtonText>
            </GButton>
          </GVStack>
        </GBox>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <GBox flex={1} px="$5">
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={{
            width: "100%",
            maxWidth: 860,
            alignSelf: "center",
            paddingTop: 24,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <GVStack space="lg">
            {!canGoBack && (
              <GButton
                variant="outline"
                action="secondary"
                onPress={() => router.replace("/(tabs)/items")}
                alignSelf="flex-start"
                testID="item-detail-back-to-items"
              >
                <GButtonText>Back to Items</GButtonText>
              </GButton>
            )}

            <GVStack space="xs" flex={1}>
              <GHeading size="2xl">{item.title}</GHeading>
              <GBadge
                size="sm"
                variant="outline"
                action="muted"
                alignSelf="flex-start"
                testID="item-usage-badge"
              >
                <GBadgeText>{item.usageType}</GBadgeText>
              </GBadge>
              <GText size="sm">Purchase date: {item.purchaseDate}</GText>
            </GVStack>

            {loadError && (
              <GCard borderWidth="$1" borderColor="$error300">
                <GText size="sm">{loadError}</GText>
              </GCard>
            )}

            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="md">
                <GHeading size="md">Attachment gallery</GHeading>
                {attachments.length === 0 ? (
                  <GText size="sm">No attachments available.</GText>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <GHStack space="sm" pr="$2">
                      {attachments.map((attachment) => {
                        const missing = missingAttachmentIds.has(attachment.id);
                        const tile = (
                          <GCard width={200} borderWidth="$1" borderColor={missing ? "$warning300" : "$border200"}>
                            <GVStack space="sm">
                              {missing ? (
                                <GBox height={120} alignItems="center" justifyContent="center">
                                  <GText size="sm">File unavailable</GText>
                                </GBox>
                              ) : isImageAttachment(attachment) ? (
                                <Image
                                  source={{ uri: attachmentPreviewUris[attachment.id] ?? attachment.filePath }}
                                  style={{ width: "100%", height: 120, borderRadius: 8 }}
                                  contentFit="cover"
                                />
                              ) : (
                                <GBox height={120} alignItems="center" justifyContent="center">
                                  <GText bold size="md">
                                    PDF
                                  </GText>
                                </GBox>
                              )}
                              <GText size="sm" numberOfLines={1}>
                                {attachment.originalFileName ?? attachment.type}
                              </GText>
                              {missing && (
                                <GBadge size="sm" action="warning" variant="outline" alignSelf="flex-start">
                                  <GBadgeText>Missing file</GBadgeText>
                                </GBadge>
                              )}
                            </GVStack>
                          </GCard>
                        );

                        if (missing) {
                          return <GBox key={attachment.id}>{tile}</GBox>;
                        }

                        return (
                          <GPressable key={attachment.id} onPress={() => setSelectedAttachment(attachment)}>
                            {tile}
                          </GPressable>
                        );
                      })}
                    </GHStack>
                  </ScrollView>
                )}
              </GVStack>
            </GCard>

            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="sm">
                <GHeading size="md">Info</GHeading>
                <InfoRow label="Title" value={item.title} />
                <InfoRow label="Category" value={categoryName} />
                <InfoRow label="Purchase date" value={item.purchaseDate} />
                <InfoRow label="Vendor" value={item.vendor?.trim() ? item.vendor : "-"} />
                <InfoRow label="% Work" value={`${infoWorkPercent}%`} />
                <InfoRow label="Warranty until" value={warrantyUntilDate ?? "n/a"} />
              </GVStack>
            </GCard>

            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="sm">
                <GHeading size="md">Calculation</GHeading>
                {calculationBreakdown ? (
                  <>
                    <InfoRow
                      label="Deductible base"
                      value={formatCents(calculationBreakdown.workRelevantCents)}
                    />
                    <InfoRow
                      label="Deductible this year"
                      value={formatCents(calculationBreakdown.deductibleThisYearCents)}
                    />
                    <InfoRow
                      label="Estimated refund impact"
                      value={formatCents(calculationBreakdown.estimatedRefundCents)}
                    />
                    <GVStack space="xs" pt="$2">
                      <GText bold size="sm">
                        Schedule by year
                      </GText>
                      {calculationBreakdown.scheduleByYear.length === 0 ? (
                        <GText size="sm">No deductible schedule available.</GText>
                      ) : (
                        calculationBreakdown.scheduleByYear.map((entry) => (
                          <GHStack key={entry.year} justifyContent="space-between" alignItems="center">
                            <GText size="sm">{entry.year}</GText>
                            <GText size="sm" bold>
                              {formatCents(entry.deductibleCents)}
                            </GText>
                          </GHStack>
                        ))
                      )}
                    </GVStack>
                  </>
                ) : (
                  <GText size="sm">Calculation data unavailable.</GText>
                )}
              </GVStack>
            </GCard>

            <GButton
              variant="outline"
              action="negative"
              onPress={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              alignSelf="flex-start"
              testID="item-detail-delete"
              accessibilityLabel={isDeleting ? "Deleting item" : "Delete item"}
              accessibilityHint="Opens a confirmation dialog."
            >
              <GHStack space="xs" alignItems="center">
                <Trash2
                  size={18}
                  strokeWidth={2}
                  color={isDeleting ? theme.textSecondary : theme.danger}
                />
                <GButtonText>{isDeleting ? "Deleting..." : "Delete"}</GButtonText>
              </GHStack>
            </GButton>
          </GVStack>
        </ScrollView>

        <GAlertDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
          <GAlertDialogBackdrop />
          <GAlertDialogContent>
            <GAlertDialogHeader>
              <GHeading size="md">Delete item?</GHeading>
            </GAlertDialogHeader>
            <GAlertDialogBody>
              <GText size="sm">
                This will delete the item and all linked attachment files from this device.
              </GText>
            </GAlertDialogBody>
            <GAlertDialogFooter>
              <GHStack space="sm">
                <GButton
                  variant="outline"
                  action="secondary"
                  onPress={() => setIsDeleteDialogOpen(false)}
                  testID="item-detail-delete-cancel"
                >
                  <GButtonText>Cancel</GButtonText>
                </GButton>
                <GButton
                  action="negative"
                  testID="item-detail-delete-confirm"
                  onPress={() => {
                    setIsDeleteDialogOpen(false);
                    void handleDelete();
                  }}
                >
                  <GButtonText>Delete</GButtonText>
                </GButton>
              </GHStack>
            </GAlertDialogFooter>
          </GAlertDialogContent>
        </GAlertDialog>

        <GModal isOpen={selectedAttachment !== null} onClose={() => setSelectedAttachment(null)}>
          <GModalBackdrop />
          <GModalContent>
            <GModalBody>
              <GVStack space="md">
                {selectedAttachment ? (
                  selectedAttachmentMissing ? (
                    <GCard borderWidth="$1" borderColor="$warning300">
                      <GText size="sm">
                        File unavailable. Open Edit Item and re-attach this document/photo.
                      </GText>
                    </GCard>
                  ) : isImageAttachment(selectedAttachment) ? (
                    <Image
                      source={{
                        uri:
                          attachmentPreviewUris[selectedAttachment.id] ?? selectedAttachment.filePath,
                      }}
                      style={{ width: "100%", height: 320, borderRadius: 8 }}
                      contentFit="contain"
                    />
                  ) : (
                    <GCard borderWidth="$1" borderColor="$border200">
                      <GText size="sm">
                        PDF preview is not available in-app yet.
                      </GText>
                    </GCard>
                  )
                ) : null}
                <GText size="sm" numberOfLines={1}>
                  {selectedAttachment?.originalFileName ?? selectedAttachment?.type}
                </GText>
                <GButton variant="outline" action="secondary" onPress={() => setSelectedAttachment(null)}>
                  <GButtonText>Close</GButtonText>
                </GButton>
              </GVStack>
            </GModalBody>
          </GModalContent>
        </GModal>
      </GBox>
    </SafeAreaView>
  );
}
