import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { Badge, Button, Card, DatePickerTrigger, FormField, Input, Select, TextArea } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { Attachment } from "@/models/attachment";
import type { Category } from "@/models/category";
import type { Item, ItemUsageType } from "@/models/item";
import {
  getAttachmentRepository,
  getCategoryRepository,
  getItemRepository,
} from "@/repositories/create-core-repositories";
import type { StoredAttachmentFile } from "@/services/attachment-storage";
import {
  saveFromCamera,
  saveFromPicker,
} from "@/services/attachment-storage";
import { deleteAttachment } from "@/services/attachment-service";
import { parseEuroInputToCents } from "@/utils/money";
import { formatYmdFromDateLocal } from "@/utils/date";
import { friendlyFileErrorMessage } from "@/services/friendly-errors";
import { attachmentFileExists, resolveAttachmentPreviewUri } from "@/services/attachment-storage";
import { validateItemInput } from "@/domain/item-validation";

function toSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isImageAttachment(attachment: Attachment): boolean {
  return attachment.mimeType.startsWith("image/");
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) {
    return "unknown size";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function withType(
  attachment: StoredAttachmentFile,
  type: "RECEIPT" | "PHOTO"
): StoredAttachmentFile {
  return { ...attachment, type };
}

const usageOptions: { value: ItemUsageType; label: string }[] = [
  { value: "WORK", label: "Work" },
  { value: "PRIVATE", label: "Private" },
  { value: "MIXED", label: "Mixed" },
  { value: "OTHER", label: "Other" },
];

export default function ItemEditRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = toSingleParam(params.id);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [item, setItem] = useState<Item | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [missingAttachmentIds, setMissingAttachmentIds] = useState<Set<string>>(new Set());
  const [attachmentPreviewUris, setAttachmentPreviewUris] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);

  const [title, setTitle] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(formatYmdFromDateLocal(new Date()));
  const [totalPrice, setTotalPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [usageType, setUsageType] = useState<ItemUsageType>("WORK");
  const [workPercent, setWorkPercent] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("");
  const [notes, setNotes] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  const parsedTotalCents = useMemo(() => parseEuroInputToCents(totalPrice), [totalPrice]);
  const parsedWorkPercent = useMemo(() => {
    const trimmed = workPercent.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  }, [workPercent]);
  const parsedWarrantyMonths = useMemo(() => {
    const trimmed = warrantyMonths.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  }, [warrantyMonths]);

  const validation = useMemo(() => {
    return validateItemInput({
      title,
      purchaseDate,
      totalCents: parsedTotalCents,
      usageType,
      workPercent: parsedWorkPercent,
      warrantyMonths: parsedWarrantyMonths,
    });
  }, [parsedTotalCents, parsedWarrantyMonths, parsedWorkPercent, purchaseDate, title, usageType]);
  const validationMessage = validation.errors[0]?.message ?? null;

  const categoryOptions = useMemo(
    () => [
      { value: "__none", label: "No category selected" },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories]
  );

  const loadEditData = useCallback(async () => {
    if (!itemId) {
      setLoadError("Missing item id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [itemRepository, attachmentRepository, categoryRepository] = await Promise.all([
        getItemRepository(),
        getAttachmentRepository(),
        getCategoryRepository(),
      ]);
      const [loadedItem, loadedAttachments, loadedCategories] = await Promise.all([
        itemRepository.getById(itemId),
        attachmentRepository.listByItem(itemId),
        categoryRepository.list(),
      ]);

      if (!loadedItem) {
        setItem(null);
        setLoadError("Item not found.");
        return;
      }

      setItem(loadedItem);
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

      setTitle(loadedItem.title);
      setPurchaseDate(loadedItem.purchaseDate);
      setTotalPrice((loadedItem.totalCents / 100).toFixed(2));
      setCategoryId(loadedItem.categoryId);
      setUsageType(loadedItem.usageType);
      setWorkPercent(loadedItem.workPercent !== null ? String(loadedItem.workPercent) : "");
      setWarrantyMonths(
        loadedItem.warrantyMonths !== null ? String(loadedItem.warrantyMonths) : ""
      );
      setNotes(loadedItem.notes ?? "");
    } catch (error) {
      console.error("Failed to load item for edit", error);
      setLoadError("Could not load item for editing.");
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  React.useEffect(() => {
    void loadEditData();
  }, [loadEditData]);

  const saveChanges = async () => {
    if (!itemId || !validation.valid || parsedTotalCents === null) {
      return;
    }

    setIsSaving(true);
    setLoadError(null);
    try {
      const repository = await getItemRepository();
      const updated = await repository.update({
        id: itemId,
        title: title.trim(),
        purchaseDate,
        totalCents: parsedTotalCents,
        usageType,
        workPercent: usageType === "MIXED" ? parsedWorkPercent : null,
        categoryId,
        warrantyMonths: parsedWarrantyMonths,
        notes: notes.trim().length > 0 ? notes.trim() : null,
      });

      setItem(updated);
      router.replace(`/item/${itemId}`);
    } catch (error) {
      console.error("Failed to update item", error);
      setLoadError("Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const addAttachment = async (kind: "receipt_camera" | "receipt_upload" | "photo_camera") => {
    if (!itemId) {
      return;
    }
    setIsAttachmentBusy(true);
    setLoadError(null);
    try {
      let picked: StoredAttachmentFile | null = null;
      if (kind === "receipt_camera") {
        const captured = await saveFromCamera();
        picked = captured ? withType(captured, "RECEIPT") : null;
      } else if (kind === "receipt_upload") {
        const uploaded = await saveFromPicker();
        picked = uploaded ? withType(uploaded, "RECEIPT") : null;
      } else {
        const captured = await saveFromCamera();
        picked = captured ? withType(captured, "PHOTO") : null;
      }

      if (!picked) {
        return;
      }

      const repository = await getAttachmentRepository();
      await repository.add({
        itemId,
        type: picked.type,
        mimeType: picked.mimeType,
        filePath: picked.filePath,
        originalFileName: picked.originalFileName,
        fileSizeBytes: picked.fileSizeBytes,
      });

      const refreshed = await repository.listByItem(itemId);
      setAttachments(refreshed);
      const checks = await Promise.all(
        refreshed.map(async (attachment) => ({
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
    } catch (error) {
      console.error("Failed to add attachment", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not add attachment."));
    } finally {
      setIsAttachmentBusy(false);
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!itemId) {
      return;
    }

    try {
      const repository = await getAttachmentRepository();
      await deleteAttachment(attachmentId);
      const refreshed = await repository.listByItem(itemId);
      setAttachments(refreshed);
      const checks = await Promise.all(
        refreshed.map(async (attachment) => ({
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
    } catch (error) {
      console.error("Failed to remove attachment", error);
      setLoadError(friendlyFileErrorMessage(error, "Could not remove attachment."));
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (name.length === 0) {
      setLoadError("Category name cannot be empty.");
      return;
    }

    setLoadError(null);
    try {
      const repository = await getCategoryRepository();
      const created = await repository.createCustomCategory({ name });
      const refreshed = await repository.list();
      setCategories(refreshed);
      setCategoryId(created.id);
      setNewCategoryName("");
    } catch (error) {
      console.error("Failed to create category", error);
      setLoadError("Could not create category.");
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText>Loading item for edit...</ThemedText>
      </ThemedView>
    );
  }

  if (!item) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="title">Edit Item</ThemedText>
        <ThemedText style={styles.errorText}>{loadError ?? "Item not found."}</ThemedText>
        <Button variant="secondary" label="Back to Items" onPress={() => router.replace("/(tabs)/items")} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Badge text="Edit Item" />
        <ThemedText type="title">Edit Item</ThemedText>
        <ThemedText themeColor="textSecondary">ID: {item.id}</ThemedText>
        <ThemedText themeColor="textSecondary">Updated at: {item.updatedAt}</ThemedText>

        {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}
        {validationMessage && <ThemedText style={styles.errorText}>{validationMessage}</ThemedText>}

        <Card>
          <FormField label="Title *">
            <Input value={title} onChangeText={setTitle} placeholder="e.g. Laptop for work" />
          </FormField>

          <FormField label="Purchase Date *">
            <DatePickerTrigger value={purchaseDate} onPress={() => setPurchaseDate(formatYmdFromDateLocal(new Date()))} />
            <Input
              value={purchaseDate}
              onChangeText={setPurchaseDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </FormField>

          <FormField label="Total Price (EUR) *">
            <Input
              value={totalPrice}
              onChangeText={setTotalPrice}
              keyboardType="decimal-pad"
              placeholder="e.g. 1299.90"
            />
          </FormField>

          <FormField label="Category">
            <Select
              value={categoryId ?? "__none"}
              options={categoryOptions}
              onChange={(nextValue) => setCategoryId(nextValue === "__none" ? null : nextValue)}
            />
            <View style={styles.row}>
              <Input
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="Create new category"
                style={styles.flexInput}
              />
              <Button variant="secondary" label="Add" onPress={() => void createCategory()} />
            </View>
          </FormField>

          <FormField label="Usage Type *">
            <Select
              value={usageType}
              options={usageOptions}
              onChange={(nextValue) => setUsageType(nextValue as ItemUsageType)}
            />
          </FormField>

          {usageType === "MIXED" && (
            <FormField label="Work Percent *">
              <Input
                value={workPercent}
                onChangeText={setWorkPercent}
                keyboardType="number-pad"
                placeholder="0-100"
              />
            </FormField>
          )}

          <FormField label="Warranty Months">
            <Input
              value={warrantyMonths}
              onChangeText={setWarrantyMonths}
              keyboardType="number-pad"
              placeholder="Optional"
            />
          </FormField>

          <FormField label="Notes">
            <TextArea
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes for invoice/audit context"
            />
          </FormField>
        </Card>

        <Card>
          <ThemedText type="smallBold">Attachments</ThemedText>
          <View style={styles.row}>
            <Button
              variant="secondary"
              label={isAttachmentBusy ? "Working..." : "Add Receipt Photo"}
              onPress={() => void addAttachment("receipt_camera")}
              disabled={isAttachmentBusy}
            />
            <Button
              variant="secondary"
              label={isAttachmentBusy ? "Working..." : "Upload Receipt PDF/Image"}
              onPress={() => void addAttachment("receipt_upload")}
              disabled={isAttachmentBusy}
            />
            <Button
              variant="secondary"
              label={isAttachmentBusy ? "Working..." : "Add Extra Photo"}
              onPress={() => void addAttachment("photo_camera")}
              disabled={isAttachmentBusy}
            />
          </View>

          {attachments.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No attachments linked.
            </ThemedText>
          ) : (
            <View style={styles.galleryGrid}>
              {attachments.map((attachment) => (
                <View key={attachment.id} style={styles.attachmentCard}>
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
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatFileSize(attachment.fileSizeBytes)}
                  </ThemedText>
                  <Button
                    variant="ghost"
                    label="Remove"
                    onPress={() =>
                      Alert.alert(
                        "Remove attachment",
                        "This will remove attachment record and delete local file. Continue?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () => void removeAttachment(attachment.id),
                          },
                        ]
                      )
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </Card>

        <View style={styles.row}>
          <Button
            variant="secondary"
            label="Cancel"
            onPress={() => router.replace(`/item/${item.id}`)}
          />
          <Button
            label={isSaving ? "Saving..." : "Save Changes"}
            onPress={() => void saveChanges()}
            disabled={validationMessage !== null || isSaving}
          />
        </View>
      </ScrollView>
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
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  flexInput: {
    flex: 1,
    minWidth: 220,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  attachmentCard: {
    width: 170,
    gap: Spacing.one,
  },
  thumbnail: {
    width: 170,
    height: 120,
    borderRadius: 10,
    backgroundColor: "#ECEDEE",
  },
  pdfTile: {
    width: 170,
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#9BA1A6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  errorText: {
    color: "#B00020",
  },
});
