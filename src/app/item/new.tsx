import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, ScrollView } from "react-native";
import {
  Actionsheet as GActionsheet,
  ActionsheetBackdrop as GActionsheetBackdrop,
  ActionsheetContent as GActionsheetContent,
  ActionsheetDragIndicator as GActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper as GActionsheetDragIndicatorWrapper,
  ActionsheetItem as GActionsheetItem,
  ActionsheetItemText as GActionsheetItemText,
  Badge as GBadge,
  BadgeText as GBadgeText,
  Box as GBox,
  Button as GButton,
  ButtonText as GButtonText,
  Card as GCard,
  Heading as GHeading,
  HStack as GHStack,
  Input as GInput,
  InputField as GInputField,
  Slider as GSlider,
  SliderFilledTrack as GSliderFilledTrack,
  SliderThumb as GSliderThumb,
  SliderTrack as GSliderTrack,
  Spinner as GSpinner,
  Text as GText,
  Textarea as GTextarea,
  TextareaInput as GTextareaInput,
  VStack as GVStack,
} from "@gluestack-ui/themed";

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
import { addMonthsToYmd, formatYmdFromDateLocal } from "@/utils/date";
import {
  friendlyFileErrorMessage,
  isUserCancellationError,
  shouldOfferOpenSettingsForError,
} from "@/services/friendly-errors";
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
  const shouldCleanupDraftOnExitRef = useRef(true);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOpenSettingsAction, setShowOpenSettingsAction] = useState(false);
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
  const [usefulLifeMonthsOverride, setUsefulLifeMonthsOverride] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const receiptAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.type === "RECEIPT"),
    [attachments]
  );
  const extraPhotos = useMemo(
    () => attachments.filter((attachment) => attachment.type === "PHOTO"),
    [attachments]
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
  const parsedUsefulLifeMonthsOverride = useMemo(() => {
    const trimmed = usefulLifeMonthsOverride.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  }, [usefulLifeMonthsOverride]);
  const usefulLifeMonthsOverrideError = useMemo(() => {
    const trimmed = usefulLifeMonthsOverride.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (parsedUsefulLifeMonthsOverride === null || parsedUsefulLifeMonthsOverride <= 0) {
      return "Useful life override must be a positive number of months.";
    }
    return null;
  }, [parsedUsefulLifeMonthsOverride, usefulLifeMonthsOverride]);

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
  const fieldErrors = useMemo(() => {
    const grouped: Record<string, string> = {};
    for (const issue of validation.errors) {
      if (!grouped[issue.field]) {
        grouped[issue.field] = issue.message;
      }
    }
    return grouped;
  }, [validation.errors]);
  const canSave = validation.valid && usefulLifeMonthsOverrideError === null && !isSavingItem;
  const selectedCategoryName = useMemo(() => {
    if (!categoryId) {
      return "No category selected";
    }
    return categories.find((entry) => entry.id === categoryId)?.name ?? "Unknown category";
  }, [categories, categoryId]);
  const warrantyUntilDate = useMemo(() => {
    if (!parsedWarrantyMonths || parsedWarrantyMonths <= 0) {
      return null;
    }
    return addMonthsToYmd(purchaseDate, parsedWarrantyMonths);
  }, [parsedWarrantyMonths, purchaseDate]);

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
      setShowOpenSettingsAction(false);
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

  useEffect(() => {
    return () => {
      if (!draftId || !shouldCleanupDraftOnExitRef.current) {
        return;
      }

      void clearItemDraft(draftId).catch((error) => {
        console.error("Failed to clear draft during route exit cleanup", error);
      });
    };
  }, [draftId]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setShowOpenSettingsAction(false);
  }, []);

  const setActionableError = useCallback(
    (error: unknown, fallback: string) => {
      setErrorMessage(friendlyFileErrorMessage(error, fallback));
      setShowOpenSettingsAction(shouldOfferOpenSettingsForError(error));
    },
    []
  );

  const openDeviceSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      setErrorMessage("Could not open device settings. Open system settings manually.");
      setShowOpenSettingsAction(false);
    }
  }, []);

  const addReceiptFromCamera = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    clearError();
    try {
      const captured = await saveFromCamera("draft");
      if (!captured) {
        return;
      }
      addAttachmentToDraft(draftId, withType(captured, "RECEIPT"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      if (isUserCancellationError(error)) {
        return;
      }
      console.error("Failed to capture receipt", error);
      setActionableError(error, "Could not capture receipt photo.");
    } finally {
      setIsBusy(false);
    }
  };

  const uploadReceipt = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    clearError();
    try {
      const picked = await saveFromPicker("draft");
      if (!picked) {
        return;
      }
      addAttachmentToDraft(draftId, withType(picked, "RECEIPT"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      if (isUserCancellationError(error)) {
        return;
      }
      console.error("Failed to upload receipt", error);
      setActionableError(error, "Could not upload receipt.");
    } finally {
      setIsBusy(false);
    }
  };

  const addExtraPhoto = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    clearError();
    try {
      const captured = await saveFromCamera("draft");
      if (!captured) {
        return;
      }
      addAttachmentToDraft(draftId, withType(captured, "PHOTO"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      if (isUserCancellationError(error)) {
        return;
      }
      console.error("Failed to capture extra photo", error);
      setActionableError(error, "Could not capture extra photo.");
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
      setActionableError(error, "Could not remove attachment.");
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (name.length === 0) {
      setErrorMessage("Category name cannot be empty.");
      setShowOpenSettingsAction(false);
      return;
    }

    setIsCreatingCategory(true);
    clearError();
    try {
      const repository = await getCategoryRepository();
      const created = await repository.createCustomCategory({ name });
      setCategoryId(created.id);
      setNewCategoryName("");
      await loadCategories();
      setIsCategorySheetOpen(false);
    } catch (error) {
      console.error("Failed to create category", error);
      setActionableError(error, "Could not create category.");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const cancelDraft = async () => {
    if (!draftId) {
      router.replace("/(tabs)/items");
      return;
    }

    setIsBusy(true);
    clearError();
    try {
      await clearItemDraft(draftId);
      router.replace("/(tabs)/items");
    } catch (error) {
      console.error("Failed to clear item draft", error);
      setActionableError(error, "Could not cancel draft safely. Please retry.");
    } finally {
      setIsBusy(false);
    }
  };

  const saveItem = async () => {
    if (
      !draftId ||
      !validation.valid ||
      parsedTotalCents === null ||
      usefulLifeMonthsOverrideError !== null
    ) {
      return;
    }

    setIsSavingItem(true);
    clearError();
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
        usefulLifeMonthsOverride:
          parsedUsefulLifeMonthsOverride !== null && parsedUsefulLifeMonthsOverride > 0
            ? parsedUsefulLifeMonthsOverride
            : null,
      });

      await linkDraftAttachmentsToItem(draftId, created.id);
      shouldCleanupDraftOnExitRef.current = false;
      router.replace(`/item/${created.id}`);
    } catch (error) {
      console.error("Failed to save item", error);
      setActionableError(error, "Could not save item. Please retry.");
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
    const workPercentSliderValue =
      parsedWorkPercent !== null && parsedWorkPercent >= 0 && parsedWorkPercent <= 100
        ? parsedWorkPercent
        : 0;

    return (
      <GBox flex={1}>
        <ScrollView
          contentContainerStyle={{
            width: "100%",
            maxWidth: 860,
            alignSelf: "center",
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 120,
          }}
        >
          <GVStack space="lg">
            <GBadge size="sm" variant="outline" action="muted" alignSelf="flex-start">
              <GBadgeText>Step 2 of 2</GBadgeText>
            </GBadge>

            <GVStack space="xs">
              <GHeading size="xl">Add Item: Fields</GHeading>
              <GText size="sm">
                Complete required fields, then save the item with the draft attachments.
              </GText>
            </GVStack>

            {errorMessage && (
              <GCard borderWidth="$1" borderColor="$error300">
                <GVStack space="sm">
                  <GText size="sm">{errorMessage}</GText>
                  {showOpenSettingsAction && (
                    <GButton
                      variant="outline"
                      action="secondary"
                      alignSelf="flex-start"
                      onPress={() => void openDeviceSettings()}
                      testID="new-item-open-settings"
                    >
                      <GButtonText>Open Settings</GButtonText>
                    </GButton>
                  )}
                </GVStack>
              </GCard>
            )}

            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="md">
                <GHeading size="md">Required fields</GHeading>

                <GVStack space="xs">
                  <GText bold size="sm">
                    1) Title *
                  </GText>
                  <GInput variant="outline">
                    <GInputField
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Laptop for work"
                      testID="new-item-step2-title-input"
                    />
                  </GInput>
                  {fieldErrors.title && (
                    <GText size="xs" color="$error600">
                      {fieldErrors.title}
                    </GText>
                  )}
                </GVStack>

                <GVStack space="xs">
                  <GText bold size="sm">
                    2) Purchase date *
                  </GText>
                  <GHStack space="sm" flexWrap="wrap" alignItems="center">
                    <GInput variant="outline" flex={1} minWidth={180}>
                      <GInputField
                        value={purchaseDate}
                        onChangeText={setPurchaseDate}
                        placeholder="YYYY-MM-DD"
                        autoCapitalize="none"
                        testID="new-item-step2-purchase-date-input"
                      />
                    </GInput>
                    <GButton
                      variant="outline"
                      action="secondary"
                      onPress={() => setPurchaseDate(formatYmdFromDateLocal(new Date()))}
                    >
                      <GButtonText>Set today</GButtonText>
                    </GButton>
                  </GHStack>
                  {fieldErrors.purchaseDate && (
                    <GText size="xs" color="$error600">
                      {fieldErrors.purchaseDate}
                    </GText>
                  )}
                </GVStack>

                <GVStack space="xs">
                  <GText bold size="sm">
                    3) Price (EUR) *
                  </GText>
                  <GInput variant="outline">
                    <GInputField
                      value={totalPrice}
                      onChangeText={setTotalPrice}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 1299.90"
                      testID="new-item-step2-total-price-input"
                    />
                  </GInput>
                  {fieldErrors.totalCents && (
                    <GText size="xs" color="$error600">
                      {fieldErrors.totalCents}
                    </GText>
                  )}
                </GVStack>

                <GVStack space="xs">
                  <GText bold size="sm">
                    4) Category
                  </GText>
                  <GButton
                    variant="outline"
                    action="secondary"
                    onPress={() => setIsCategorySheetOpen(true)}
                    justifyContent="space-between"
                    testID="new-item-step2-category-open"
                  >
                    <GButtonText>{selectedCategoryName}</GButtonText>
                  </GButton>
                  {isLoadingCategories && (
                    <GHStack space="sm" alignItems="center">
                      <GSpinner size="small" />
                      <GText size="xs">Loading categories...</GText>
                    </GHStack>
                  )}
                  <GHStack space="sm" flexWrap="wrap" alignItems="center">
                    <GInput variant="outline" flex={1} minWidth={200}>
                      <GInputField
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                        placeholder="Create new category"
                        testID="new-item-step2-category-create-input"
                      />
                    </GInput>
                    <GButton
                      variant="outline"
                      action="secondary"
                      onPress={() => void createCategory()}
                      disabled={isCreatingCategory}
                      testID="new-item-step2-category-create-button"
                    >
                      <GButtonText>{isCreatingCategory ? "Adding..." : "Add"}</GButtonText>
                    </GButton>
                  </GHStack>
                </GVStack>

                <GVStack space="xs">
                  <GText bold size="sm">
                    5) Usage type *
                  </GText>
                  <GHStack space="sm" flexWrap="wrap">
                    {usageOptions.map((option) => (
                      <GButton
                        key={option.value}
                        size="sm"
                        variant={usageType === option.value ? "solid" : "outline"}
                        action={usageType === option.value ? "primary" : "secondary"}
                        onPress={() => setUsageType(option.value)}
                        testID={`new-item-step2-usage-${option.value.toLowerCase()}`}
                      >
                        <GButtonText>{option.label.toUpperCase()}</GButtonText>
                      </GButton>
                    ))}
                  </GHStack>
                </GVStack>

                {usageType === "MIXED" && (
                  <GVStack space="xs">
                    <GText bold size="sm">
                      6) Work percent *
                    </GText>
                    <GInput variant="outline">
                      <GInputField
                        value={workPercent}
                        onChangeText={setWorkPercent}
                        keyboardType="number-pad"
                        placeholder="0-100"
                        testID="new-item-step2-work-percent-input"
                      />
                    </GInput>
                    <GSlider
                      value={workPercentSliderValue}
                      minValue={0}
                      maxValue={100}
                      step={1}
                      onChange={(value) => {
                        const nextValue = Array.isArray(value) ? value[0] : value;
                        if (typeof nextValue === "number" && Number.isFinite(nextValue)) {
                          setWorkPercent(String(Math.round(nextValue)));
                        }
                      }}
                    >
                      <GSliderTrack>
                        <GSliderFilledTrack />
                      </GSliderTrack>
                      <GSliderThumb />
                    </GSlider>
                    {fieldErrors.workPercent && (
                      <GText size="xs" color="$error600">
                        {fieldErrors.workPercent}
                      </GText>
                    )}
                  </GVStack>
                )}
              </GVStack>
            </GCard>

            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="md">
                <GHeading size="md">Optional</GHeading>

                <GVStack space="xs">
                  <GText bold size="sm">
                    Notes
                  </GText>
                  <GTextarea>
                    <GTextareaInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Optional notes for invoice or audit context"
                      testID="new-item-step2-notes-input"
                    />
                  </GTextarea>
                  {(usageType === "WORK" || usageType === "MIXED") && notes.trim().length === 0 && (
                    <GBadge size="sm" action="warning" variant="outline" alignSelf="flex-start">
                      <GBadgeText>Missing notes will be flagged</GBadgeText>
                    </GBadge>
                  )}
                </GVStack>

                <GVStack space="xs">
                  <GText bold size="sm">
                    Warranty months
                  </GText>
                  <GInput variant="outline">
                    <GInputField
                      value={warrantyMonths}
                      onChangeText={setWarrantyMonths}
                      keyboardType="number-pad"
                      placeholder="Optional"
                      testID="new-item-step2-warranty-months-input"
                    />
                  </GInput>
                  {fieldErrors.warrantyMonths && (
                    <GText size="xs" color="$error600">
                      {fieldErrors.warrantyMonths}
                    </GText>
                  )}
                  <GText size="xs">Warranty until: {warrantyUntilDate ?? "n/a"}</GText>
                </GVStack>

                <GVStack space="xs">
                  <GText bold size="sm">
                    Vendor
                  </GText>
                  <GInput variant="outline">
                    <GInputField
                      value={vendor}
                      onChangeText={setVendor}
                      placeholder="Optional vendor/store"
                      testID="new-item-step2-vendor-input"
                    />
                  </GInput>
                </GVStack>
              </GVStack>
            </GCard>

            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="md">
                <GHStack alignItems="center" justifyContent="space-between">
                  <GHeading size="md">Advanced</GHeading>
                  <GButton
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={() => setIsAdvancedOpen((current) => !current)}
                    testID="new-item-step2-advanced-toggle"
                  >
                    <GButtonText>{isAdvancedOpen ? "Hide" : "Show"}</GButtonText>
                  </GButton>
                </GHStack>
                {isAdvancedOpen && (
                  <GVStack space="xs">
                    <GText bold size="sm">
                      Useful life override (months)
                    </GText>
                    <GInput variant="outline">
                      <GInputField
                        value={usefulLifeMonthsOverride}
                        onChangeText={setUsefulLifeMonthsOverride}
                        keyboardType="number-pad"
                        placeholder="Optional, e.g. 36"
                        testID="new-item-step2-useful-life-input"
                      />
                    </GInput>
                    {usefulLifeMonthsOverrideError && (
                      <GText size="xs" color="$error600">
                        {usefulLifeMonthsOverrideError}
                      </GText>
                    )}
                  </GVStack>
                )}
              </GVStack>
            </GCard>

            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="sm">
                <GHeading size="sm">Draft attachment summary</GHeading>
                <GText size="sm">Receipts: {receiptAttachments.length}</GText>
                <GText size="sm">Extra photos: {extraPhotos.length}</GText>
                {receiptAttachments.length === 0 && (
                  <GBadge size="sm" action="warning" variant="outline" alignSelf="flex-start">
                    <GBadgeText>No receipt attached (allowed, flagged later)</GBadgeText>
                  </GBadge>
                )}
              </GVStack>
            </GCard>
          </GVStack>
        </ScrollView>

        <GBox borderTopWidth="$1" borderColor="$border200" bg="$background0" px="$5" py="$3">
          <GHStack space="sm" flexWrap="wrap" justifyContent="flex-end">
            <GButton
              variant="outline"
              action="secondary"
              onPress={() =>
                router.replace({
                  pathname: "/item/new",
                  params: { draftId: draftId ?? "", step: "1" },
                })
              }
              testID="new-item-step2-back"
            >
              <GButtonText>Back to Step 1</GButtonText>
            </GButton>
            <GButton
              variant="outline"
              action="secondary"
              onPress={() => void cancelDraft()}
              disabled={isBusy}
              testID="new-item-step2-cancel"
            >
              <GButtonText>Cancel</GButtonText>
            </GButton>
            <GButton
              onPress={() => void saveItem()}
              disabled={!canSave || isBusy}
              testID="new-item-step2-save"
            >
              <GButtonText>{isSavingItem ? "Saving..." : "Save Item"}</GButtonText>
            </GButton>
          </GHStack>
        </GBox>

        <GActionsheet isOpen={isCategorySheetOpen} onClose={() => setIsCategorySheetOpen(false)}>
          <GActionsheetBackdrop />
          <GActionsheetContent>
            <GActionsheetDragIndicatorWrapper>
              <GActionsheetDragIndicator />
            </GActionsheetDragIndicatorWrapper>
            <GActionsheetItem
              onPress={() => {
                setCategoryId(null);
                setIsCategorySheetOpen(false);
              }}
            >
              <GActionsheetItemText>No category selected</GActionsheetItemText>
            </GActionsheetItem>
            {categories.map((category) => (
              <GActionsheetItem
                key={category.id}
                onPress={() => {
                  setCategoryId(category.id);
                  setIsCategorySheetOpen(false);
                }}
              >
                <GActionsheetItemText>{category.name}</GActionsheetItemText>
              </GActionsheetItem>
            ))}
          </GActionsheetContent>
        </GActionsheet>
      </GBox>
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
              <GVStack space="sm">
                <GText size="sm">{errorMessage}</GText>
                {showOpenSettingsAction && (
                  <GButton
                    variant="outline"
                    action="secondary"
                    alignSelf="flex-start"
                    onPress={() => void openDeviceSettings()}
                    testID="new-item-open-settings"
                  >
                    <GButtonText>Open Settings</GButtonText>
                  </GButton>
                )}
              </GVStack>
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
