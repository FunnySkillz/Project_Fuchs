import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Badge as GBadge,
  BadgeText as GBadgeText,
  Box as GBox,
  Button as GButton,
  ButtonText as GButtonText,
  Card as GCard,
  Heading as GHeading,
  HStack as GHStack,
  Spinner as GSpinner,
  Text as GText,
  VStack as GVStack,
} from "@gluestack-ui/themed";

import {
  Badge as LegacyBadge,
  Button as LegacyButton,
  Card as LegacyCard,
  DatePickerTrigger,
  FormField,
  Input,
  Select,
  TextArea,
} from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { AttachmentType } from "@/models/attachment";
import type { Category } from "@/models/category";
import type { ItemUsageType } from "@/models/item";
import { getCategoryRepository, getItemRepository } from "@/repositories/create-core-repositories";
import type { StoredAttachmentFile } from "@/services/attachment-storage";
import { saveFromCamera, saveFromPicker } from "@/services/attachment-storage";
import {
  addAttachmentToDraft,
  clearItemDraft,
  createItemDraft,
  getItemDraftAttachments,
  linkDraftAttachmentsToItem,
  removeAttachmentFromDraft,
} from "@/services/item-draft-store";
import { parseEuroInputToCents } from "@/utils/money";
import { formatYmdFromDateLocal } from "@/utils/date";
import { friendlyFileErrorMessage } from "@/services/friendly-errors";
import { validateItemInput } from "@/domain/item-validation";

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
  const [vendor, setVendor] = useState("");
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

  const validation = useMemo(() => {
    return validateItemInput({
      title,
      purchaseDate,
      totalCents: parsedTotalCents,
      usageType,
      workPercent: parsedWorkPercent,
      warrantyMonths: parsedWarrantyMonths,
    });
  }, [title, purchaseDate, parsedTotalCents, usageType, parsedWorkPercent, parsedWarrantyMonths]);
  const validationMessage = validation.errors[0]?.message ?? null;

  const canSave = validation.valid && !isSavingItem;

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
      const captured = await saveFromCamera();
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
      const picked = await saveFromPicker();
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
      const captured = await saveFromCamera();
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

  const cancelDraft = async () => {
    if (!draftId) {
      router.replace("/(tabs)/items");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      await clearItemDraft(draftId);
      router.replace("/(tabs)/items");
    } catch (error) {
      console.error("Failed to clear item draft", error);
      setErrorMessage("Could not cancel draft safely. Please retry.");
    } finally {
      setIsBusy(false);
    }
  };

  const saveItem = async () => {
    if (!draftId || !validation.valid || parsedTotalCents === null) {
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
        workPercent: usageType === "MIXED" ? parsedWorkPercent : null,
        categoryId,
        vendor: vendor.trim().length > 0 ? vendor.trim() : null,
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
      <GBox flex={1} alignItems="center" justifyContent="center" px="$5" py="$6">
        <GVStack space="md" alignItems="center">
          <GSpinner size="large" />
          <GText size="sm">Preparing item draft...</GText>
        </GVStack>
      </GBox>
    );
  }

  if (step === "2") {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <LegacyBadge text="Step 2 of 2" />
          <ThemedText type="title">Add Item: Core Fields</ThemedText>
          <ThemedText themeColor="textSecondary">
            Complete item details, validate input, and save. Draft attachments are linked after save.
          </ThemedText>

          {errorMessage && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}
          {validationMessage && <ThemedText style={styles.errorText}>{validationMessage}</ThemedText>}

          <LegacyCard>
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
                <LegacyButton variant="secondary" label="Add" onPress={() => void createCategory()} />
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

            <FormField label="Vendor">
              <Input
                value={vendor}
                onChangeText={setVendor}
                placeholder="Optional vendor/store name"
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
              <LegacyBadge text="Missing notes will be flagged" variant="warning" />
            )}
          </LegacyCard>

          <LegacyCard>
            <ThemedText type="smallBold">Draft Attachment Summary</ThemedText>
            <ThemedText type="small">Receipts: {receiptAttachments.length}</ThemedText>
            <ThemedText type="small">Extra photos: {extraPhotos.length}</ThemedText>
            {receiptAttachments.length === 0 && (
              <LegacyBadge text="No receipt attached (allowed, flagged later)" variant="warning" />
            )}
          </LegacyCard>

          <View style={styles.row}>
            <LegacyButton
              variant="secondary"
              label="Back to Step 1"
              onPress={() =>
                router.replace({
                  pathname: "/item/new",
                  params: { draftId: draftId ?? "", step: "1" },
                })
              }
            />
            <LegacyButton
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
    <GBox flex={1} px="$5" py="$6">
      <ScrollView
        contentContainerStyle={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          paddingBottom: 24,
        }}
      >
        <GVStack space="lg">
          <GBadge size="sm" variant="outline" action="muted" alignSelf="flex-start">
            <GBadgeText>Step 1 of 2</GBadgeText>
          </GBadge>

          <GVStack space="xs">
            <GHeading size="xl">Add Item: Attachments</GHeading>
            <GText size="sm">
              Add receipt files first. Additional photos are optional.
            </GText>
          </GVStack>

          {errorMessage && (
            <GCard borderWidth="$1" borderColor="$error300">
              <GText size="sm">{errorMessage}</GText>
            </GCard>
          )}

          <GCard borderWidth="$1" borderColor="$border200">
            <GVStack space="md">
              <GHeading size="md">Add receipt</GHeading>
              <GHStack space="sm" flexWrap="wrap">
                <GButton
                  variant="outline"
                  action="secondary"
                  onPress={() => void addReceiptFromCamera()}
                  disabled={isBusy}
                  testID="new-item-step1-take-photo"
                >
                  <GButtonText>{isBusy ? "Working..." : "Take photo"}</GButtonText>
                </GButton>
                <GButton
                  variant="outline"
                  action="secondary"
                  onPress={() => void uploadReceipt()}
                  disabled={isBusy}
                  testID="new-item-step1-upload"
                >
                  <GButtonText>{isBusy ? "Working..." : "Upload PDF/Image"}</GButtonText>
                </GButton>
              </GHStack>
              <GText size="sm">Receipts attached: {receiptAttachments.length}</GText>
            </GVStack>
          </GCard>

          <GCard borderWidth="$1" borderColor="$border200">
            <GVStack space="md">
              <GHeading size="md">Additional photos (optional)</GHeading>
              <GButton
                variant="outline"
                action="secondary"
                onPress={() => void addExtraPhoto()}
                disabled={isBusy}
                alignSelf="flex-start"
                testID="new-item-step1-add-extra-photo"
              >
                <GButtonText>{isBusy ? "Working..." : "Add extra photo"}</GButtonText>
              </GButton>
              <GText size="sm">Extra photos attached: {extraPhotos.length}</GText>
            </GVStack>
          </GCard>

          {attachments.length === 0 ? (
            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="sm">
                <GText bold size="md">
                  No files attached yet
                </GText>
                <GText size="sm">
                  You can continue to Step 2 without attachments. Missing receipts are flagged later.
                </GText>
              </GVStack>
            </GCard>
          ) : (
            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="sm">
                <GHeading size="md">Preview</GHeading>
                {attachments.map((attachment) => (
                  <GHStack key={attachment.filePath} justifyContent="space-between" alignItems="center" space="sm">
                    <GVStack flex={1} space="xs">
                      <GText bold size="sm">
                        {attachment.type === "RECEIPT" ? "Receipt" : "Photo"}
                      </GText>
                      <GText size="sm">{attachment.originalFileName ?? "Unnamed file"}</GText>
                      <GText size="sm">{formatFileSize(attachment.fileSizeBytes)}</GText>
                    </GVStack>
                    <GButton
                      variant="link"
                      action="secondary"
                      onPress={() => void removeAttachment(attachment.filePath)}
                    >
                      <GButtonText>Remove</GButtonText>
                    </GButton>
                  </GHStack>
                ))}
              </GVStack>
            </GCard>
          )}

          <GHStack space="sm" flexWrap="wrap">
            <GButton
              variant="outline"
              action="secondary"
              onPress={() => void cancelDraft()}
              disabled={isBusy}
              testID="new-item-step1-cancel"
            >
              <GButtonText>Cancel</GButtonText>
            </GButton>
            <GButton
              onPress={() =>
                router.replace({
                  pathname: "/item/new",
                  params: { draftId: draftId ?? "", step: "2" },
                })
              }
              disabled={isBusy}
              testID="new-item-step1-continue"
            >
              <GButtonText>Continue</GButtonText>
            </GButton>
          </GHStack>
        </GVStack>
      </ScrollView>
    </GBox>
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
