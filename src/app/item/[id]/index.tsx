import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Badge, Button, Card } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { estimateTaxImpact } from "@/domain/calculation-engine";
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
import { formatCents } from "@/utils/money";
import { addMonthsToYmd } from "@/utils/date";
import { attachmentFileExists, resolveAttachmentPreviewUri } from "@/services/attachment-storage";
import { friendlyFileErrorMessage } from "@/services/friendly-errors";
import { deleteAttachment } from "@/services/attachment-service";

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

function resolveWorkShare(item: Item, defaultWorkPercent: number): number {
  if (item.usageType === "WORK") {
    return 1;
  }
  if (item.usageType === "PRIVATE") {
    return 0;
  }
  if (item.usageType === "MIXED") {
    const percent = item.workPercent ?? defaultWorkPercent;
    return Math.max(0, Math.min(100, percent)) / 100;
  }
  return 0;
}

export default function ItemDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = toSingleParam(params.id);

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

  React.useEffect(() => {
    void loadItem();
  }, [loadItem]);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const categoryName = item?.categoryId ? categoryMap.get(item.categoryId)?.name ?? "Unknown" : "None";
  const warrantyUntilDate = item ? computeWarrantyUntilDate(item.purchaseDate, item.warrantyMonths) : null;

  const calculationBreakdown = useMemo(() => {
    if (!item || !settings) {
      return null;
    }

    const workShare = resolveWorkShare(item, settings.defaultWorkPercent);
    const workRelevantCents = Math.round(item.totalCents * workShare);
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
      workShare,
      workRelevantCents,
      usefulLifeMonths,
      immediate: workRelevantCents <= settings.gwgThresholdCents,
      deductibleThisYearCents: estimate.deductibleThisYearCents,
      estimatedRefundCents: estimate.estimatedRefundThisYearCents,
      scheduleByYear: estimate.scheduleByYear,
      explanations: estimate.explanations,
    };
  }, [categoryMap, item, settings]);

  const handleDelete = async () => {
    if (!itemId || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      const [itemRepository, attachmentRepository] = await Promise.all([
        getItemRepository(),
        getAttachmentRepository(),
      ]);
      const linkedAttachments = await attachmentRepository.listByItem(itemId);
      await Promise.all(linkedAttachments.map((attachment) => deleteAttachment(attachment.id)));

      const repository = itemRepository;
      await repository.softDelete(itemId);
      router.replace("/(tabs)/items");
    } catch (error) {
      console.error("Failed to delete item", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not delete item."));
    } finally {
      setIsDeleting(false);
    }
  };

  const promptDelete = () => {
    Alert.alert(
      "Delete item",
      "This will delete the item and all linked attachment files. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void handleDelete() },
      ]
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText>Loading item details...</ThemedText>
      </ThemedView>
    );
  }

  if (!item) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="title">Item Detail</ThemedText>
        <ThemedText style={styles.errorText}>{loadError ?? "Item not found."}</ThemedText>
        <Button variant="secondary" label="Back to Items" onPress={() => router.replace("/(tabs)/items")} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <ThemedText type="title">{item.title}</ThemedText>
            <ThemedText themeColor="textSecondary">Purchase date: {item.purchaseDate}</ThemedText>
          </View>
          <Badge text={item.usageType} />
        </View>

        {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}

        <Card>
          <ThemedText type="smallBold">Key Fields</ThemedText>
          <ThemedText type="small">Item ID: {item.id}</ThemedText>
          <ThemedText type="small">Price: {formatCents(item.totalCents)}</ThemedText>
          <ThemedText type="small">Currency: {item.currency}</ThemedText>
          <ThemedText type="small">Category: {categoryName}</ThemedText>
          <ThemedText type="small">Usage type: {item.usageType}</ThemedText>
          <ThemedText type="small">Vendor: {item.vendor?.trim() ? item.vendor : "-"}</ThemedText>
          <ThemedText type="small">
            Work percent: {item.usageType === "MIXED" ? `${item.workPercent ?? settings?.defaultWorkPercent ?? 0}%` : "n/a"}
          </ThemedText>
          <ThemedText type="small">
            Useful life override:{" "}
            {item.usefulLifeMonthsOverride && item.usefulLifeMonthsOverride > 0
              ? `${item.usefulLifeMonthsOverride} months`
              : "none"}
          </ThemedText>
          <ThemedText type="small">
            Warranty: {item.warrantyMonths && item.warrantyMonths > 0 ? `${item.warrantyMonths} months` : "none"}
          </ThemedText>
          <ThemedText type="small">Warranty until: {warrantyUntilDate ?? "n/a"}</ThemedText>
          <ThemedText type="small">Notes: {item.notes?.trim() ? item.notes : "-"}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Created at: {item.createdAt}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Updated at: {item.updatedAt}
          </ThemedText>
        </Card>

        <Card>
          <ThemedText type="smallBold">Calculation Breakdown</ThemedText>
          {calculationBreakdown ? (
            <>
              <ThemedText type="small">Work share: {(calculationBreakdown.workShare * 100).toFixed(0)}%</ThemedText>
              <ThemedText type="small">
                Work-relevant amount: {formatCents(calculationBreakdown.workRelevantCents)}
              </ThemedText>
              <ThemedText type="small">
                Mode: {calculationBreakdown.immediate ? "Immediate deduction (below GWG)" : "AfA schedule"}
              </ThemedText>
              <ThemedText type="small">
                Useful life months: {calculationBreakdown.usefulLifeMonths}
              </ThemedText>
              <ThemedText type="small">
                Deductible this year: {formatCents(calculationBreakdown.deductibleThisYearCents)}
              </ThemedText>
              <ThemedText type="small">
                Estimated refund: {formatCents(calculationBreakdown.estimatedRefundCents)}
              </ThemedText>
              <ThemedText type="smallBold">Schedule by year</ThemedText>
              {calculationBreakdown.scheduleByYear.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No deductible schedule available.
                </ThemedText>
              ) : (
                calculationBreakdown.scheduleByYear.map((entry) => (
                  <ThemedText key={entry.year} type="small">
                    {entry.year}: {formatCents(entry.deductibleCents)}
                  </ThemedText>
                ))
              )}
              <ThemedText type="smallBold">Explanation</ThemedText>
              {calculationBreakdown.explanations.map((line, index) => (
                <ThemedText key={`${index}-${line}`} type="small" themeColor="textSecondary">
                  - {line}
                </ThemedText>
              ))}
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Calculation data unavailable.
            </ThemedText>
          )}
        </Card>

        <Card>
          <ThemedText type="smallBold">Attachment Gallery</ThemedText>
          {attachments.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No attachments available.
            </ThemedText>
          ) : (
            <View style={styles.galleryGrid}>
              {attachments.map((attachment) => (
                <Pressable
                  key={attachment.id}
                  onPress={() => {
                    if (missingAttachmentIds.has(attachment.id)) {
                      Alert.alert(
                        "Attachment missing",
                        "The local file is missing. Open Edit Item and re-attach this document/photo."
                      );
                      return;
                    }
                    setSelectedAttachment(attachment);
                  }}
                  style={({ pressed }) => [styles.galleryTile, pressed && styles.pressed]}>
                  {isImageAttachment(attachment) ? (
                    <Image
                      source={{ uri: attachmentPreviewUris[attachment.id] ?? attachment.filePath }}
                      style={styles.thumbnail}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.pdfTile}>
                      <ThemedText type="smallBold">PDF</ThemedText>
                    </View>
                  )}
                  <ThemedText type="small" numberOfLines={1}>
                    {attachment.originalFileName ?? attachment.type}
                  </ThemedText>
                  {missingAttachmentIds.has(attachment.id) && (
                    <Badge text="Missing file" variant="warning" />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <View style={styles.actionRow}>
          <Button
            variant="secondary"
            label="Edit"
            onPress={() => router.push(`/item/${item.id}/edit`)}
          />
          <Button
            variant="danger"
            label={isDeleting ? "Deleting..." : "Delete"}
            onPress={promptDelete}
            disabled={isDeleting}
          />
        </View>
      </ScrollView>

      <Modal visible={selectedAttachment !== null} transparent animationType="fade" onRequestClose={() => setSelectedAttachment(null)}>
        <View style={styles.fullscreenOverlay}>
          <Pressable style={styles.fullscreenCloseArea} onPress={() => setSelectedAttachment(null)} />
          <View style={styles.fullscreenCard}>
            {selectedAttachment && isImageAttachment(selectedAttachment) ? (
              <Image source={{ uri: selectedAttachment.filePath }} style={styles.fullscreenImage} contentFit="contain" />
            ) : (
              <View style={styles.fullscreenPdfFallback}>
                <ThemedText type="smallBold">PDF Preview</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Full-screen preview for PDF is not available in-app yet.
                </ThemedText>
              </View>
            )}
            <ThemedText type="small" numberOfLines={1}>
              {selectedAttachment?.originalFileName ?? selectedAttachment?.type}
            </ThemedText>
            <Button variant="secondary" label="Close" onPress={() => setSelectedAttachment(null)} />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.four,
  },
  content: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  headerTextGroup: {
    flex: 1,
    gap: Spacing.one,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  galleryTile: {
    width: 150,
    gap: Spacing.one,
  },
  thumbnail: {
    width: 150,
    height: 120,
    borderRadius: 10,
    backgroundColor: "#ECEDEE",
  },
  pdfTile: {
    width: 150,
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#9BA1A6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.two,
    flexWrap: "wrap",
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: Spacing.four,
  },
  fullscreenCloseArea: {
    ...StyleSheet.absoluteFillObject,
  },
  fullscreenCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#9BA1A6",
    backgroundColor: "#FFFFFF",
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fullscreenImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#111111",
    borderRadius: 10,
  },
  fullscreenPdfFallback: {
    width: "100%",
    padding: Spacing.four,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#9BA1A6",
    backgroundColor: "#FFFFFF",
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.75,
  },
  errorText: {
    color: "#B00020",
  },
});
