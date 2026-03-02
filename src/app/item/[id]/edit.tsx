import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Linking, Modal, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
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
  Spinner,
  Text,
  Textarea,
  TextareaInput,
  VStack,
} from "@gluestack-ui/themed";

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
  attachmentFileExists,
  deleteLocalAttachmentFile,
  resolveAttachmentPreviewUri,
  saveFromCamera,
  saveFromPicker,
} from "@/services/attachment-storage";
import { deleteAttachment } from "@/services/attachment-service";
import {
  friendlyFileErrorMessage,
  isUserCancellationError,
  shouldOfferOpenSettingsForError,
} from "@/services/friendly-errors";
import { validateItemInput } from "@/domain/item-validation";
import { addMonthsToYmd, formatYmdFromDateLocal } from "@/utils/date";
import { parseEuroInputToCents } from "@/utils/money";

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
  { value: "WORK", label: "WORK" },
  { value: "PRIVATE", label: "PRIVATE" },
  { value: "MIXED", label: "MIXED" },
  { value: "OTHER", label: "OTHER" },
];

interface InitialSnapshot {
  title: string;
  purchaseDate: string;
  totalPrice: string;
  categoryId: string | null;
  usageType: ItemUsageType;
  workPercent: string;
  warrantyMonths: string;
  vendor: string;
  notes: string;
  usefulLifeMonthsOverride: string;
}

export default function ItemEditRoute() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = toSingleParam(params.id);
  const allowNavigationExitRef = useRef(false);
  const initialSnapshotRef = useRef<InitialSnapshot | null>(null);
  const initialSnapshotCapturedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOpenSettingsAction, setShowOpenSettingsAction] = useState(false);

  const [item, setItem] = useState<Item | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [missingAttachmentIds, setMissingAttachmentIds] = useState<Set<string>>(new Set());
  const [attachmentPreviewUris, setAttachmentPreviewUris] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);

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
  const [newCategoryName, setNewCategoryName] = useState("");

  const parsedTotalCents = useMemo(() => parseEuroInputToCents(totalPrice), [totalPrice]);
  const parsedWorkPercent = useMemo(() => {
    const trimmed = workPercent.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [workPercent]);
  const parsedWarrantyMonths = useMemo(() => {
    const trimmed = warrantyMonths.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [warrantyMonths]);
  const parsedUsefulLifeMonthsOverride = useMemo(() => {
    const trimmed = usefulLifeMonthsOverride.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
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
  }, [parsedTotalCents, parsedWarrantyMonths, parsedWorkPercent, purchaseDate, title, usageType]);

  const fieldErrors = useMemo(() => {
    const grouped: Record<string, string> = {};
    for (const issue of validation.errors) {
      if (!grouped[issue.field]) {
        grouped[issue.field] = issue.message;
      }
    }
    return grouped;
  }, [validation.errors]);

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) {
      return "No category selected";
    }
    return categories.find((entry) => entry.id === categoryId)?.name ?? "Unknown category";
  }, [categories, categoryId]);

  const isDirty = useMemo(() => {
    const initial = initialSnapshotRef.current;
    if (!initial) {
      return false;
    }
    return (
      title !== initial.title ||
      purchaseDate !== initial.purchaseDate ||
      totalPrice !== initial.totalPrice ||
      categoryId !== initial.categoryId ||
      usageType !== initial.usageType ||
      workPercent !== initial.workPercent ||
      warrantyMonths !== initial.warrantyMonths ||
      vendor !== initial.vendor ||
      notes !== initial.notes ||
      usefulLifeMonthsOverride !== initial.usefulLifeMonthsOverride ||
      newCategoryName.trim().length > 0
    );
  }, [
    categoryId,
    newCategoryName,
    notes,
    purchaseDate,
    title,
    totalPrice,
    usageType,
    usefulLifeMonthsOverride,
    vendor,
    warrantyMonths,
    workPercent,
  ]);

  const canSave = validation.valid && usefulLifeMonthsOverrideError === null && !isSaving;

  const clearLoadError = useCallback(() => {
    setLoadError(null);
    setShowOpenSettingsAction(false);
  }, []);

  const setActionableLoadError = useCallback((error: unknown, fallback: string) => {
    setLoadError(friendlyFileErrorMessage(error, fallback));
    setShowOpenSettingsAction(shouldOfferOpenSettingsForError(error));
  }, []);

  const openDeviceSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      setLoadError("Could not open device settings. Open system settings manually.");
      setShowOpenSettingsAction(false);
    }
  }, []);

  const refreshAttachmentReadModel = useCallback(async (nextAttachments: Attachment[]) => {
    const checks = await Promise.all(
      nextAttachments.map(async (attachment) => ({
        id: attachment.id,
        exists: await attachmentFileExists(attachment.filePath),
        previewUri: await resolveAttachmentPreviewUri(attachment.filePath, attachment.mimeType),
      }))
    );
    setMissingAttachmentIds(new Set(checks.filter((entry) => !entry.exists).map((entry) => entry.id)));
    setAttachmentPreviewUris(Object.fromEntries(checks.map((entry) => [entry.id, entry.previewUri])));
  }, []);

  const loadEditData = useCallback(async () => {
    if (!itemId) {
      setLoadError("Missing item id.");
      setIsLoading(false);
      return;
    }

    initialSnapshotCapturedRef.current = false;
    initialSnapshotRef.current = null;
    setIsLoading(true);
    clearLoadError();
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
      setCategories(loadedCategories);
      await refreshAttachmentReadModel(loadedAttachments);

      setTitle(loadedItem.title);
      setPurchaseDate(loadedItem.purchaseDate);
      setTotalPrice((loadedItem.totalCents / 100).toFixed(2));
      setCategoryId(loadedItem.categoryId);
      setUsageType(loadedItem.usageType);
      setWorkPercent(loadedItem.workPercent !== null ? String(loadedItem.workPercent) : "");
      setWarrantyMonths(loadedItem.warrantyMonths !== null ? String(loadedItem.warrantyMonths) : "");
      setVendor(loadedItem.vendor ?? "");
      setNotes(loadedItem.notes ?? "");
      setUsefulLifeMonthsOverride(
        loadedItem.usefulLifeMonthsOverride !== null ? String(loadedItem.usefulLifeMonthsOverride) : ""
      );
      setNewCategoryName("");
    } catch (error) {
      console.error("Failed to load item for edit", error);
      setActionableLoadError(error, "Could not load item for editing.");
    } finally {
      setIsLoading(false);
    }
  }, [clearLoadError, itemId, refreshAttachmentReadModel, setActionableLoadError]);

  React.useEffect(() => {
    void loadEditData();
  }, [loadEditData]);

  useEffect(() => {
    if (isLoading || !item || initialSnapshotCapturedRef.current) {
      return;
    }

    initialSnapshotRef.current = {
      title,
      purchaseDate,
      totalPrice,
      categoryId,
      usageType,
      workPercent,
      warrantyMonths,
      vendor,
      notes,
      usefulLifeMonthsOverride,
    };
    initialSnapshotCapturedRef.current = true;
  }, [
    categoryId,
    isLoading,
    item,
    notes,
    purchaseDate,
    title,
    totalPrice,
    usageType,
    usefulLifeMonthsOverride,
    vendor,
    warrantyMonths,
    workPercent,
  ]);

  const goBackFromEditFlow = useCallback(() => {
    allowNavigationExitRef.current = true;
    setIsDiscardModalOpen(false);

    const navigationWithBack = navigation as {
      canGoBack?: () => boolean;
      goBack?: () => void;
    };
    if (
      typeof navigationWithBack.canGoBack === "function" &&
      navigationWithBack.canGoBack() &&
      typeof navigationWithBack.goBack === "function"
    ) {
      navigationWithBack.goBack();
      return;
    }

    if (itemId) {
      router.replace(`/item/${itemId}`);
      return;
    }

    router.replace("/(tabs)/items");
  }, [itemId, navigation, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event: any) => {
      if (allowNavigationExitRef.current) {
        return;
      }

      if (isDirty) {
        event.preventDefault();
        setIsDiscardModalOpen(true);
      }
    });

    return unsubscribe;
  }, [isDirty, navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isDirty) {
        setIsDiscardModalOpen(true);
        return true;
      }
      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [isDirty]);

  const handleExitRequest = useCallback(() => {
    if (!isDirty) {
      goBackFromEditFlow();
      return;
    }
    setIsDiscardModalOpen(true);
  }, [goBackFromEditFlow, isDirty]);

  const saveChanges = async () => {
    if (!itemId || !validation.valid || parsedTotalCents === null || usefulLifeMonthsOverrideError !== null) {
      return;
    }

    setIsSaving(true);
    clearLoadError();
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
        vendor: vendor.trim().length > 0 ? vendor.trim() : null,
        warrantyMonths: parsedWarrantyMonths,
        notes: notes.trim().length > 0 ? notes.trim() : null,
        usefulLifeMonthsOverride:
          parsedUsefulLifeMonthsOverride !== null && parsedUsefulLifeMonthsOverride > 0
            ? parsedUsefulLifeMonthsOverride
            : null,
      });

      setItem(updated);
      allowNavigationExitRef.current = true;
      router.replace(`/item/${itemId}`);
    } catch (error) {
      console.error("Failed to update item", error);
      setActionableLoadError(error, "Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const addAttachment = async (kind: "receipt_camera" | "receipt_upload" | "photo_camera") => {
    if (!itemId) {
      return;
    }
    setIsAttachmentBusy(true);
    clearLoadError();
    let picked: StoredAttachmentFile | null = null;
    let attachmentPersisted = false;
    try {
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
      attachmentPersisted = true;

      const refreshed = await repository.listByItem(itemId);
      setAttachments(refreshed);
      await refreshAttachmentReadModel(refreshed);
    } catch (error) {
      if (isUserCancellationError(error)) {
        return;
      }
      if (picked?.filePath && !attachmentPersisted) {
        try {
          await deleteLocalAttachmentFile(picked.filePath);
        } catch (cleanupError) {
          console.error("Failed to clean up attachment file after add error", cleanupError);
        }
      }
      console.error("Failed to add attachment", error);
      setActionableLoadError(error, "Could not add attachment.");
    } finally {
      setIsAttachmentBusy(false);
    }
  };

  const removeAttachmentById = async (attachmentId: string) => {
    if (!itemId) {
      return;
    }

    try {
      const repository = await getAttachmentRepository();
      await deleteAttachment(attachmentId);
      const refreshed = await repository.listByItem(itemId);
      setAttachments(refreshed);
      await refreshAttachmentReadModel(refreshed);
    } catch (error) {
      console.error("Failed to remove attachment", error);
      setActionableLoadError(error, "Could not remove attachment.");
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (name.length === 0) {
      setLoadError("Category name cannot be empty.");
      setShowOpenSettingsAction(false);
      return;
    }

    setIsCreatingCategory(true);
    clearLoadError();
    try {
      const repository = await getCategoryRepository();
      const created = await repository.createCustomCategory({ name });
      const refreshed = await repository.list();
      setCategories(refreshed);
      setCategoryId(created.id);
      setNewCategoryName("");
      setIsCategorySheetOpen(false);
    } catch (error) {
      console.error("Failed to create category", error);
      setActionableLoadError(error, "Could not create category.");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const closeDiscardModal = () => {
    setIsDiscardModalOpen(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Box flex={1} alignItems="center" justifyContent="center" px="$5" py="$6">
          <VStack space="md" alignItems="center">
            <Spinner size="large" />
            <Text size="sm">Loading item for edit...</Text>
          </VStack>
        </Box>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Box flex={1} px="$5" py="$6">
          <VStack space="lg" maxWidth={760} width="$full" alignSelf="center">
            <Heading size="xl">Edit Item</Heading>
            <Card borderWidth="$1" borderColor="$error300">
              <VStack space="sm">
                <Text bold size="md">
                  Could not load item
                </Text>
                <Text size="sm">{loadError ?? "Item not found."}</Text>
                <HStack space="sm" flexWrap="wrap">
                  <Button variant="outline" action="secondary" onPress={() => void loadEditData()}>
                    <ButtonText>Retry</ButtonText>
                  </Button>
                  {showOpenSettingsAction ? (
                    <Button
                      variant="outline"
                      action="secondary"
                      onPress={() => void openDeviceSettings()}
                    >
                      <ButtonText>Open Settings</ButtonText>
                    </Button>
                  ) : null}
                </HStack>
              </VStack>
            </Card>
            <Button variant="outline" action="secondary" onPress={() => router.replace("/(tabs)/items")}>
              <ButtonText>Back to Items</ButtonText>
            </Button>
          </VStack>
        </Box>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Box flex={1} px="$5" py="$6">
        <ScrollView
          contentContainerStyle={{
            width: "100%",
            maxWidth: 860,
            alignSelf: "center",
            paddingBottom: insets.bottom + 24,
          }}
        >
          <VStack space="lg">
          <VStack space="xs">
            <Heading size="2xl">Edit Item</Heading>
            <Text size="sm">
              Update details and attachments for {item.title}.
            </Text>
          </VStack>

          {loadError ? (
            <Card borderWidth="$1" borderColor="$error300">
              <VStack space="sm">
                <Text size="sm">{loadError}</Text>
                <HStack space="sm" flexWrap="wrap">
                  <Button variant="outline" action="secondary" onPress={() => void loadEditData()}>
                    <ButtonText>Retry</ButtonText>
                  </Button>
                  {showOpenSettingsAction ? (
                    <Button
                      variant="outline"
                      action="secondary"
                      onPress={() => void openDeviceSettings()}
                    >
                      <ButtonText>Open Settings</ButtonText>
                    </Button>
                  ) : null}
                </HStack>
              </VStack>
            </Card>
          ) : null}

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <Heading size="md">Fields</Heading>

              <VStack space="xs">
                <Text bold size="sm">
                  Title *
                </Text>
                <Input variant="outline">
                  <InputField
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Work laptop"
                    testID="item-edit-title-input"
                  />
                </Input>
                {fieldErrors.title ? <Text size="xs" color="$error600">{fieldErrors.title}</Text> : null}
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Purchase date *
                </Text>
                <HStack space="sm" flexWrap="wrap" alignItems="center">
                  <Input variant="outline" flex={1} minWidth={180}>
                    <InputField
                      value={purchaseDate}
                      onChangeText={setPurchaseDate}
                      placeholder="YYYY-MM-DD"
                      testID="item-edit-purchase-date-input"
                    />
                  </Input>
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => setPurchaseDate(formatYmdFromDateLocal(new Date()))}
                  >
                    <ButtonText>Set today</ButtonText>
                  </Button>
                </HStack>
                {fieldErrors.purchaseDate ? (
                  <Text size="xs" color="$error600">{fieldErrors.purchaseDate}</Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Price (EUR) *
                </Text>
                <Input variant="outline">
                  <InputField
                    value={totalPrice}
                    onChangeText={setTotalPrice}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 1299.90"
                    testID="item-edit-total-price-input"
                  />
                </Input>
                {fieldErrors.totalCents ? (
                  <Text size="xs" color="$error600">{fieldErrors.totalCents}</Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Category
                </Text>
                <Button
                  variant="outline"
                  action="secondary"
                  justifyContent="space-between"
                  onPress={() => setIsCategorySheetOpen(true)}
                  testID="item-edit-category-open"
                >
                  <ButtonText>{selectedCategoryName}</ButtonText>
                </Button>
                <HStack space="sm" flexWrap="wrap" alignItems="center">
                  <Input variant="outline" flex={1} minWidth={200}>
                    <InputField
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      placeholder="Create new category"
                      testID="item-edit-category-create-input"
                    />
                  </Input>
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => void createCategory()}
                    disabled={isCreatingCategory}
                    testID="item-edit-category-create-button"
                  >
                    <ButtonText>{isCreatingCategory ? "Adding..." : "Add"}</ButtonText>
                  </Button>
                </HStack>
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Usage type *
                </Text>
                <HStack space="sm" flexWrap="wrap">
                  {usageOptions.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={usageType === option.value ? "solid" : "outline"}
                      action={usageType === option.value ? "primary" : "secondary"}
                      onPress={() => setUsageType(option.value)}
                      testID={`item-edit-usage-${option.value.toLowerCase()}`}
                    >
                      <ButtonText>{option.label}</ButtonText>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {usageType === "MIXED" ? (
                <VStack space="xs">
                  <Text bold size="sm">
                    Work percent *
                  </Text>
                  <Input variant="outline">
                    <InputField
                      value={workPercent}
                      onChangeText={setWorkPercent}
                      keyboardType="number-pad"
                      placeholder="0-100"
                      testID="item-edit-work-percent-input"
                    />
                  </Input>
                  {fieldErrors.workPercent ? (
                    <Text size="xs" color="$error600">{fieldErrors.workPercent}</Text>
                  ) : null}
                </VStack>
              ) : null}

              <VStack space="xs">
                <Text bold size="sm">
                  Warranty months
                </Text>
                <Input variant="outline">
                  <InputField
                    value={warrantyMonths}
                    onChangeText={setWarrantyMonths}
                    keyboardType="number-pad"
                    placeholder="Optional"
                    testID="item-edit-warranty-months-input"
                  />
                </Input>
                {fieldErrors.warrantyMonths ? (
                  <Text size="xs" color="$error600">{fieldErrors.warrantyMonths}</Text>
                ) : null}
                <Text size="xs" color="$textLight500">
                  Warranty until: {parsedWarrantyMonths && parsedWarrantyMonths > 0 ? addMonthsToYmd(purchaseDate, parsedWarrantyMonths) : "n/a"}
                </Text>
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Vendor
                </Text>
                <Input variant="outline">
                  <InputField
                    value={vendor}
                    onChangeText={setVendor}
                    placeholder="Optional vendor/store"
                    testID="item-edit-vendor-input"
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Useful life override (months)
                </Text>
                <Input variant="outline">
                  <InputField
                    value={usefulLifeMonthsOverride}
                    onChangeText={setUsefulLifeMonthsOverride}
                    keyboardType="number-pad"
                    placeholder="Optional, e.g. 36"
                    testID="item-edit-useful-life-input"
                  />
                </Input>
                {usefulLifeMonthsOverrideError ? (
                  <Text size="xs" color="$error600">{usefulLifeMonthsOverrideError}</Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Notes
                </Text>
                <Textarea>
                  <TextareaInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional notes for invoice/audit context"
                    testID="item-edit-notes-input"
                  />
                </Textarea>
                <Text size="xs" color="$textLight500">
                  Optional. Missing notes may be flagged later.
                </Text>
              </VStack>
            </VStack>
          </Card>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <Heading size="md">Attachments</Heading>
              <HStack space="sm" flexWrap="wrap">
                <Button
                  variant="outline"
                  action="secondary"
                  disabled={isAttachmentBusy}
                  onPress={() => void addAttachment("receipt_camera")}
                >
                  <ButtonText>{isAttachmentBusy ? "Working..." : "Add Receipt Photo"}</ButtonText>
                </Button>
                <Button
                  variant="outline"
                  action="secondary"
                  disabled={isAttachmentBusy}
                  onPress={() => void addAttachment("receipt_upload")}
                >
                  <ButtonText>{isAttachmentBusy ? "Working..." : "Upload Receipt PDF/Image"}</ButtonText>
                </Button>
                <Button
                  variant="outline"
                  action="secondary"
                  disabled={isAttachmentBusy}
                  onPress={() => void addAttachment("photo_camera")}
                >
                  <ButtonText>{isAttachmentBusy ? "Working..." : "Add Extra Photo"}</ButtonText>
                </Button>
              </HStack>

              {attachments.length === 0 ? (
                <Card borderWidth="$1" borderColor="$border200">
                  <Text size="sm">No attachments linked to this item.</Text>
                </Card>
              ) : (
                <VStack space="sm">
                  {attachments.map((attachment) => {
                    const missing = missingAttachmentIds.has(attachment.id);
                    return (
                      <Card key={attachment.id} borderWidth="$1" borderColor={missing ? "$warning300" : "$border200"}>
                        <VStack space="sm">
                          <HStack justifyContent="space-between" alignItems="center" space="sm">
                            <VStack flex={1} space="xs">
                              <Text bold size="sm" numberOfLines={1}>
                                {attachment.originalFileName ?? attachment.type}
                              </Text>
                              <Text size="xs">{formatFileSize(attachment.fileSizeBytes)}</Text>
                            </VStack>
                            <Button
                              size="sm"
                              variant="outline"
                              action="secondary"
                              onPress={() => void removeAttachmentById(attachment.id)}
                            >
                              <ButtonText>Remove</ButtonText>
                            </Button>
                          </HStack>

                          {missing ? (
                            <Card borderWidth="$1" borderColor="$warning300">
                              <Text size="sm">Attachment file missing on disk.</Text>
                            </Card>
                          ) : isImageAttachment(attachment) ? (
                            <Image
                              source={{ uri: attachmentPreviewUris[attachment.id] ?? attachment.filePath }}
                              style={{ width: "100%", height: 140, borderRadius: 8 }}
                              contentFit="cover"
                            />
                          ) : (
                            <Card borderWidth="$1" borderColor="$border200">
                              <Text size="sm">PDF file attached.</Text>
                            </Card>
                          )}

                          {missing ? (
                            <Badge size="sm" action="warning" variant="outline" alignSelf="flex-start">
                              <BadgeText>Missing file</BadgeText>
                            </Badge>
                          ) : null}
                        </VStack>
                      </Card>
                    );
                  })}
                </VStack>
              )}
            </VStack>
          </Card>

          <HStack space="sm" flexWrap="wrap">
            <Button
              variant="outline"
              action="secondary"
              onPress={handleExitRequest}
              testID="edititem-cancel"
              accessibilityLabel="Cancel editing item"
            >
              <ButtonText testID="item-edit-cancel">Cancel</ButtonText>
            </Button>
            <Button
              onPress={() => void saveChanges()}
              disabled={!canSave}
              testID="item-edit-save"
            >
              <ButtonText>{isSaving ? "Saving..." : "Save Changes"}</ButtonText>
            </Button>
          </HStack>
          </VStack>
        </ScrollView>

        <Actionsheet isOpen={isCategorySheetOpen} onClose={() => setIsCategorySheetOpen(false)}>
          <ActionsheetBackdrop />
          <ActionsheetContent>
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator />
            </ActionsheetDragIndicatorWrapper>
            <ActionsheetItem
              onPress={() => {
                setCategoryId(null);
                setIsCategorySheetOpen(false);
              }}
            >
              <ActionsheetItemText>No category selected</ActionsheetItemText>
            </ActionsheetItem>
            {categories.map((category) => (
              <ActionsheetItem
                key={category.id}
                onPress={() => {
                  setCategoryId(category.id);
                  setIsCategorySheetOpen(false);
                }}
              >
                <ActionsheetItemText>{category.name}</ActionsheetItemText>
              </ActionsheetItem>
            ))}
          </ActionsheetContent>
        </Actionsheet>

        <Modal
          visible={isDiscardModalOpen}
          transparent
          animationType="fade"
          onRequestClose={closeDiscardModal}
        >
          <Box
            flex={1}
            alignItems="center"
            justifyContent="center"
            px="$5"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            testID="discard-modal"
          >
            <Card borderWidth="$1" borderColor="$border200" width="$full" maxWidth={420}>
              <VStack space="md">
                <VStack space="xs">
                  <Heading size="md">Discard changes?</Heading>
                  <Text size="sm">Your changes and draft attachments will be lost.</Text>
                </VStack>
                <HStack justifyContent="flex-end" space="sm">
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={closeDiscardModal}
                    testID="keep-editing"
                    accessibilityLabel="Keep editing"
                  >
                    <ButtonText testID="item-edit-discard-keepediting">Keep editing</ButtonText>
                  </Button>
                  <Button
                    size="sm"
                    action="negative"
                    onPress={goBackFromEditFlow}
                    testID="discard-confirm"
                    accessibilityLabel="Discard changes"
                  >
                    <ButtonText testID="item-edit-discard-confirm">Discard</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </Card>
          </Box>
        </Modal>
      </Box>
    </SafeAreaView>
  );
}
