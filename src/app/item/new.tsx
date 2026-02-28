import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { Badge, Button, Card, DatePickerTrigger, FormField, Input, Select, TextArea } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { AttachmentType } from "@/models/attachment";
import type { Category } from "@/models/category";
import type { ItemUsageType } from "@/models/item";
import { getCategoryRepository, getItemRepository } from "@/repositories/create-core-repositories";
import type { StoredAttachmentFile } from "@/services/attachment-storage";
import { capturePhotoAttachment, pickAttachmentFromDevice } from "@/services/attachment-storage";
import {
  addAttachmentToDraft,
  createItemDraft,
  getItemDraftAttachments,
  linkDraftAttachmentsToItem,
  removeAttachmentFromDraft,
} from "@/services/item-draft-store";
import { parseEuroInputToCents } from "@/utils/money";
import { formatYmdFromDateLocal, isValidYmd } from "@/utils/date";
import { friendlyFileErrorMessage } from "@/services/friendly-errors";

function toSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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

function withType(attachment: StoredAttachmentFile, type: AttachmentType): StoredAttachmentFile {
  return {
    ...attachment,
    type,
  };
}

const usageOptions: { value: ItemUsageType; label: string }[] = [
  { value: "WORK", label: "Work" },
  { value: "PRIVATE", label: "Private" },
  { value: "MIXED", label: "Mixed" },
  { value: "OTHER", label: "Other" },
];

export default function NewItemRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ draftId?: string | string[]; step?: string | string[] }>();
  const draftId = toSingleParam(params.draftId);
  const step = toSingleParam(params.step) ?? "1";

  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<StoredAttachmentFile[]>([]);

  const [title, setTitle] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(formatYmdFromDateLocal(new Date()));
  const [totalPrice, setTotalPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [usageType, setUsageType] = useState<ItemUsageType>("WORK");
  const [workPercent, setWorkPercent] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("");
  const [notes, setNotes] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const receiptAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.type === "RECEIPT"),
    [attachments]
  );
  const extraPhotos = useMemo(
    () => attachments.filter((attachment) => attachment.type === "PHOTO"),
    [attachments]
  );

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

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

  const validationMessage = useMemo(() => {
    if (title.trim().length === 0) {
      return "Title is required.";
    }
    if (!isValidYmd(purchaseDate)) {
      return "Purchase date must be valid (YYYY-MM-DD).";
    }
    if (parsedTotalCents === null) {
      return "Total price is required and must be a valid amount (e.g. 1234.56).";
    }
    if (usageType === "MIXED") {
      if (parsedWorkPercent === null) {
        return "Work percent is required for mixed usage.";
      }
      if (parsedWorkPercent < 0 || parsedWorkPercent > 100) {
        return "Work percent must be between 0 and 100.";
      }
    }
    if (parsedWarrantyMonths !== null && parsedWarrantyMonths < 0) {
      return "Warranty months must be 0 or higher.";
    }

    return null;
  }, [title, purchaseDate, parsedTotalCents, usageType, parsedWorkPercent, parsedWarrantyMonths]);

  const canSave = validationMessage === null && !isSavingItem;

  const reloadDraftAttachments = useCallback((id: string) => {
    setAttachments(getItemDraftAttachments(id));
  }, []);

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const categoryRepository = await getCategoryRepository();
      const loaded = await categoryRepository.list();
      setCategories(loaded);
      if (loaded.length === 0) {
        setCategoryId(null);
      } else if (categoryId && !loaded.some((category) => category.id === categoryId)) {
        setCategoryId(null);
      }
    } catch (error) {
      console.error("Failed to load categories", error);
      setErrorMessage("Could not load categories.");
    } finally {
      setIsLoadingCategories(false);
    }
  }, [categoryId]);

  useEffect(() => {
    if (draftId) {
      reloadDraftAttachments(draftId);
      setIsInitializing(false);
      void loadCategories();
      return;
    }

    const createdDraftId = createItemDraft();
    router.replace({
      pathname: "/item/new",
      params: { draftId: createdDraftId, step: "1" },
    });
  }, [draftId, loadCategories, reloadDraftAttachments, router]);

  const addReceiptFromCamera = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const captured = await capturePhotoAttachment();
      if (!captured) {
        return;
      }
      addAttachmentToDraft(draftId, withType(captured, "RECEIPT"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      console.error("Failed to capture receipt", error);
      setErrorMessage(friendlyFileErrorMessage(error, "Could not capture receipt photo."));
    } finally {
      setIsBusy(false);
    }
  };

  const uploadReceipt = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const picked = await pickAttachmentFromDevice();
      if (!picked) {
        return;
      }
      addAttachmentToDraft(draftId, withType(picked, "RECEIPT"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      console.error("Failed to upload receipt", error);
      setErrorMessage(friendlyFileErrorMessage(error, "Could not upload receipt."));
    } finally {
      setIsBusy(false);
    }
  };

  const addExtraPhoto = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const captured = await capturePhotoAttachment();
      if (!captured) {
        return;
      }
      addAttachmentToDraft(draftId, withType(captured, "PHOTO"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      console.error("Failed to capture extra photo", error);
      setErrorMessage(friendlyFileErrorMessage(error, "Could not capture extra photo."));
    } finally {
      setIsBusy(false);
    }
  };

  const removeAttachment = async (filePath: string) => {
    if (!draftId) {
      return;
    }
    try {
      await removeAttachmentFromDraft(draftId, filePath);
      reloadDraftAttachments(draftId);
    } catch (error) {
      console.error("Failed to remove attachment", error);
      setErrorMessage(friendlyFileErrorMessage(error, "Could not remove attachment."));
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (name.length === 0) {
      setErrorMessage("Category name cannot be empty.");
      return;
    }

    setErrorMessage(null);
    try {
      const repository = await getCategoryRepository();
      const created = await repository.createCustomCategory({ name });
      setCategoryId(created.id);
      setNewCategoryName("");
      await loadCategories();
    } catch (error) {
      console.error("Failed to create category", error);
      setErrorMessage("Could not create category.");
    }
  };

  const saveItem = async () => {
    if (!draftId || validationMessage !== null || parsedTotalCents === null) {
      return;
    }

    setIsSavingItem(true);
    setErrorMessage(null);
    try {
      const itemRepository = await getItemRepository();
      const created = await itemRepository.create({
        title: title.trim(),
        purchaseDate,
        totalCents: parsedTotalCents,
        usageType,
        workPercent: usageType === "MIXED" ? parsedWorkPercent ?? 0 : null,
        categoryId,
        warrantyMonths: parsedWarrantyMonths,
        notes: notes.trim().length > 0 ? notes.trim() : null,
      });

      await linkDraftAttachmentsToItem(draftId, created.id);
      router.replace(`/item/${created.id}`);
    } catch (error) {
      console.error("Failed to save item", error);
      setErrorMessage("Could not save item. Please retry.");
    } finally {
      setIsSavingItem(false);
    }
  };

  if (isInitializing) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText>Preparing item draft...</ThemedText>
      </ThemedView>
    );
  }

  if (step === "2") {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Badge text="Step 2 of 2" />
          <ThemedText type="title">Add Item: Core Fields</ThemedText>
          <ThemedText themeColor="textSecondary">
            Complete item details, validate input, and save. Draft attachments are linked after save.
          </ThemedText>

          {errorMessage && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}
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
              <ThemedText type="small" themeColor="textSecondary">
                Tap the date row to set today, or enter date manually as YYYY-MM-DD.
              </ThemedText>
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
                value={categoryId}
                options={categoryOptions}
                placeholder={isLoadingCategories ? "Loading categories..." : "No category selected"}
                onChange={(nextValue) => setCategoryId(nextValue)}
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

            {(usageType === "WORK" || usageType === "MIXED") && notes.trim().length === 0 && (
              <Badge text="Missing notes will be flagged" variant="warning" />
            )}
          </Card>

          <Card>
            <ThemedText type="smallBold">Draft Attachment Summary</ThemedText>
            <ThemedText type="small">Receipts: {receiptAttachments.length}</ThemedText>
            <ThemedText type="small">Extra photos: {extraPhotos.length}</ThemedText>
            {receiptAttachments.length === 0 && (
              <Badge text="No receipt attached (allowed, flagged later)" variant="warning" />
            )}
          </Card>

          <View style={styles.row}>
            <Button
              variant="secondary"
              label="Back to Step 1"
              onPress={() =>
                router.replace({
                  pathname: "/item/new",
                  params: { draftId: draftId ?? "", step: "1" },
                })
              }
            />
            <Button
              label={isSavingItem ? "Saving..." : "Save Item"}
              onPress={() => void saveItem()}
              disabled={!canSave}
            />
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Badge text="Step 1 of 2" />
        <ThemedText type="title">Add Item: Attachments</ThemedText>
        <ThemedText themeColor="textSecondary">
          Add a receipt photo/upload and optional extra photos. You can continue without attachments.
        </ThemedText>

        {errorMessage && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}

        <Card>
          <ThemedText type="smallBold">Receipt</ThemedText>
          <View style={styles.row}>
            <Button
              variant="secondary"
              label={isBusy ? "Working..." : "Capture Receipt Photo"}
              onPress={() => void addReceiptFromCamera()}
              disabled={isBusy}
            />
            <Button
              variant="secondary"
              label={isBusy ? "Working..." : "Upload PDF/Image"}
              onPress={() => void uploadReceipt()}
              disabled={isBusy}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Receipts attached: {receiptAttachments.length}
          </ThemedText>
        </Card>

        <Card>
          <ThemedText type="smallBold">Extra Photos (product/box/serial)</ThemedText>
          <Button
            variant="secondary"
            label={isBusy ? "Working..." : "Add Extra Photo"}
            onPress={() => void addExtraPhoto()}
            disabled={isBusy}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Extra photos attached: {extraPhotos.length}
          </ThemedText>
        </Card>

        {attachments.length > 0 && (
          <Card>
            <ThemedText type="smallBold">Attached Files</ThemedText>
            {attachments.map((attachment) => (
              <View key={attachment.filePath} style={styles.attachmentRow}>
                <View style={styles.attachmentMeta}>
                  <ThemedText type="smallBold">
                    {attachment.type === "RECEIPT" ? "Receipt" : "Photo"}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {attachment.originalFileName ?? "Unnamed file"}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatFileSize(attachment.fileSizeBytes)}
                  </ThemedText>
                </View>
                <Button
                  variant="ghost"
                  label="Remove"
                  onPress={() => {
                    Alert.alert(
                      "Remove attachment",
                      "This will delete the local draft file. Continue?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => void removeAttachment(attachment.filePath),
                        },
                      ]
                    );
                  }}
                />
              </View>
            ))}
          </Card>
        )}

        <Button
          label="Continue to Step 2"
          onPress={() =>
            router.replace({
              pathname: "/item/new",
              params: { draftId: draftId ?? "", step: "2" },
            })
          }
        />
        <ThemedText type="small" themeColor="textSecondary">
          You can continue even with no attachments. Missing receipt is flagged later.
        </ThemedText>
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
    maxWidth: 720,
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
    minWidth: 200,
  },
  attachmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  attachmentMeta: {
    flex: 1,
    gap: 2,
  },
  errorText: {
    color: "#B00020",
  },
});
