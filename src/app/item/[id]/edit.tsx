import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { HeaderBackButton } from "@react-navigation/elements";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Linking, Modal, Platform, Pressable, ScrollView } from "react-native";
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
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

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
import { useI18n } from "@/contexts/language-context";
import { useTheme } from "@/hooks/use-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { validateItemInput } from "@/domain/item-validation";
import { resolveWorkPercent } from "@/domain/work-percent";
import { addMonthsToYmd, formatYmdFromDateLocal, parseYmd } from "@/utils/date";
import { parseEuroInputToCents } from "@/utils/money";

const iosSwiftUI = (() => {
  if (Platform.OS !== "ios") {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const swiftUI = require("@expo/ui/swift-ui");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modifiers = require("@expo/ui/swift-ui/modifiers");
    return {
      Host: swiftUI.Host,
      DatePicker: swiftUI.DatePicker,
      datePickerStyle: modifiers.datePickerStyle,
    };
  } catch {
    return null;
  }
})();

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

function toLocalDateFromYmd(value: string): Date {
  const parsed = parseYmd(value);
  if (!parsed) {
    return new Date();
  }
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

const usageOptions: { value: ItemUsageType; label: string }[] = [
  { value: "WORK", label: "WORK" },
  { value: "PRIVATE", label: "PRIVATE" },
  { value: "MIXED", label: "MIXED" },
  { value: "OTHER", label: "OTHER" },
];

type FieldKey =
  | "title"
  | "purchaseDate"
  | "totalCents"
  | "workPercent"
  | "warrantyMonths"
  | "usefulLifeMonthsOverride";

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

type FocusTarget = {
  focus?: () => void;
};

export default function ItemEditRoute() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const itemId = toSingleParam(params.id);
  const allowNavigationExitRef = useRef(false);
  const pendingNavigationActionRef = useRef<any | null>(null);
  const isDirtyRef = useRef(false);
  const isDiscardModalOpenRef = useRef(false);
  const initialSnapshotRef = useRef<InitialSnapshot | null>(null);
  const initialSnapshotCapturedRef = useRef(false);
  const fieldYRef = useRef<Partial<Record<FieldKey, number>>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const inputRef = useRef<Partial<Record<FieldKey, FocusTarget | null>>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOpenSettingsAction, setShowOpenSettingsAction] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldKey, boolean>>>({});

  const [item, setItem] = useState<Item | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [missingAttachmentIds, setMissingAttachmentIds] = useState<Set<string>>(new Set());
  const [attachmentPreviewUris, setAttachmentPreviewUris] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(formatYmdFromDateLocal(new Date()));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());
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
  const resolvedWorkUsagePercent = useMemo(
    () => resolveWorkPercent(usageType, parsedWorkPercent),
    [parsedWorkPercent, usageType]
  );
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

  const requiredTitleMessage = t("item.form.required.title");
  const requiredPurchaseDateMessage = t("item.form.required.purchaseDate");
  const requiredTotalCentsMessage = t("item.form.required.totalCents");

  const usefulLifeMonthsOverrideError = useMemo(() => {
    const trimmed = usefulLifeMonthsOverride.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (parsedUsefulLifeMonthsOverride === null || parsedUsefulLifeMonthsOverride <= 0) {
      return t("item.form.usefulLife.errorPositiveMonths");
    }
    return null;
  }, [parsedUsefulLifeMonthsOverride, t, usefulLifeMonthsOverride]);

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

  const validationMessages = useMemo(() => {
    return {
      title: fieldErrors.title ? requiredTitleMessage : undefined,
      purchaseDate: fieldErrors.purchaseDate
        ? purchaseDate.trim().length === 0
          ? requiredPurchaseDateMessage
          : fieldErrors.purchaseDate
        : undefined,
      totalCents: fieldErrors.totalCents ? requiredTotalCentsMessage : undefined,
      workPercent: fieldErrors.workPercent,
      warrantyMonths: fieldErrors.warrantyMonths,
    };
  }, [
    fieldErrors,
    purchaseDate,
    requiredPurchaseDateMessage,
    requiredTitleMessage,
    requiredTotalCentsMessage,
  ]);

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) {
      return t("item.form.category.noneSelected");
    }
    return categories.find((entry) => entry.id === categoryId)?.name ?? t("item.form.category.unknown");
  }, [categories, categoryId, t]);

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

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    isDiscardModalOpenRef.current = isDiscardModalOpen;
  }, [isDiscardModalOpen]);

  const isFormValid = validation.valid && usefulLifeMonthsOverrideError === null;
  const isActionBusy = isSaving || isAttachmentBusy || isCreatingCategory;
  const isSaveDisabled = (submitAttempted && !isFormValid) || isActionBusy;

  const setFieldTouched = useCallback((field: FieldKey) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }, []);

  const shouldShowFieldError = useCallback(
    (field: FieldKey) => Boolean((submitAttempted || touchedFields[field]) && fieldErrors[field]),
    [fieldErrors, submitAttempted, touchedFields]
  );

  const showUsefulLifeError = Boolean(
    (submitAttempted || touchedFields.usefulLifeMonthsOverride) && usefulLifeMonthsOverrideError
  );

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
      setLoadError(t("item.form.error.openDeviceSettings"));
      setShowOpenSettingsAction(false);
    }
  }, [t]);

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
      setLoadError(t("item.detail.errorMissingId"));
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
        setLoadError(t("item.detail.notFound"));
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
      setSubmitAttempted(false);
      setTouchedFields({});
      setNewCategoryName("");
    } catch (error) {
      console.error("Failed to load item for edit", error);
      setActionableLoadError(error, t("item.edit.error.loadForEditing"));
    } finally {
      setIsLoading(false);
    }
  }, [clearLoadError, itemId, refreshAttachmentReadModel, setActionableLoadError, t]);

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
    const pendingAction = pendingNavigationActionRef.current;
    pendingNavigationActionRef.current = null;

    if (pendingAction) {
      navigation.dispatch(pendingAction);
      return;
    }

    if (typeof navigation.canGoBack === "function" && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (itemId) {
      router.replace(`/item/${itemId}`);
      return;
    }

    router.replace("/(tabs)/items");
  }, [itemId, navigation, router]);

  const handleExitRequest = useCallback(() => {
    if (!isDirty) {
      goBackFromEditFlow();
      return;
    }
    pendingNavigationActionRef.current = null;
    setIsDiscardModalOpen(true);
  }, [goBackFromEditFlow, isDirty]);

  const closeDiscardModal = useCallback(() => {
    pendingNavigationActionRef.current = null;
    setIsDiscardModalOpen(false);
  }, []);

  const openPurchaseDatePicker = useCallback(() => {
    setFieldTouched("purchaseDate");
    setDatePickerValue(toLocalDateFromYmd(purchaseDate));

    if (Platform.OS === "web") {
      const next = globalThis.prompt?.(
        t("item.form.purchaseDate.webPrompt"),
        purchaseDate
      );
      if (!next) {
        return;
      }
      const normalized = next.trim();
      if (parseYmd(normalized)) {
        setPurchaseDate(normalized);
      }
      return;
    }

    setIsDatePickerOpen(true);
  }, [purchaseDate, setFieldTouched, t]);

  const onAndroidPurchaseDatePickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setIsDatePickerOpen(false);
        if (event.type !== "set" || !selectedDate) {
          return;
        }
        setDatePickerValue(selectedDate);
        setPurchaseDate(formatYmdFromDateLocal(selectedDate));
        return;
      }

      if (selectedDate) {
        setDatePickerValue(selectedDate);
      }
    },
    []
  );

  const onIosPurchaseDateChange = useCallback((selectedDate: Date) => {
    setDatePickerValue(selectedDate);
  }, []);

  const onIosFallbackPurchaseDatePickerChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (selectedDate) {
        setDatePickerValue(selectedDate);
      }
    },
    []
  );

  const closePurchaseDatePicker = useCallback(() => {
    setIsDatePickerOpen(false);
  }, []);

  const confirmPurchaseDatePicker = useCallback(() => {
    setPurchaseDate(formatYmdFromDateLocal(datePickerValue));
    setIsDatePickerOpen(false);
  }, [datePickerValue]);

  useEffect(() => {
    const navigationWithOptions = navigation as {
      setOptions?: (options: {
        headerLeft?: (props: { canGoBack?: boolean; tintColor?: string }) => React.ReactNode;
      }) => void;
    };
    if (typeof navigationWithOptions.setOptions !== "function") {
      return;
    }

    navigationWithOptions.setOptions({
      headerLeft: (props: { canGoBack?: boolean; tintColor?: string }) =>
        props.canGoBack ? (
          <HeaderBackButton
            testID="edititem-header-back"
            tintColor={props.tintColor}
            onPress={handleExitRequest}
          />
        ) : null,
    });
  }, [handleExitRequest, navigation]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener("beforeRemove", (event: any) => {
        if (allowNavigationExitRef.current || !isDirtyRef.current) {
          return;
        }

        event.preventDefault();
        pendingNavigationActionRef.current = event.data.action;
        setIsDiscardModalOpen(true);
      });

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (isDiscardModalOpenRef.current) {
          closeDiscardModal();
          return true;
        }
        if (isDirtyRef.current) {
          pendingNavigationActionRef.current = null;
          setIsDiscardModalOpen(true);
          return true;
        }
        goBackFromEditFlow();
        return true;
      });

      return () => {
        unsubscribe();
        subscription.remove();
      };
    }, [closeDiscardModal, goBackFromEditFlow, navigation])
  );

  const scrollToField = useCallback((field: FieldKey) => {
    const y = fieldYRef.current[field];
    if (typeof y !== "number") {
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
  }, []);

  const focusField = useCallback((field: FieldKey) => {
    const target = inputRef.current[field];
    if (!target || typeof target.focus !== "function") {
      return;
    }
    requestAnimationFrame(() => {
      target.focus?.();
    });
  }, []);

  const getFirstInvalidField = useCallback((): FieldKey | null => {
    if (fieldErrors.title) {
      return "title";
    }
    if (fieldErrors.purchaseDate) {
      return "purchaseDate";
    }
    if (fieldErrors.totalCents) {
      return "totalCents";
    }
    if (fieldErrors.workPercent) {
      return "workPercent";
    }
    if (fieldErrors.warrantyMonths) {
      return "warrantyMonths";
    }
    if (usefulLifeMonthsOverrideError) {
      return "usefulLifeMonthsOverride";
    }
    return null;
  }, [fieldErrors, usefulLifeMonthsOverrideError]);

  const saveChanges = async () => {
    setSubmitAttempted(true);
    if (!itemId || !isFormValid || parsedTotalCents === null) {
      const firstInvalid = getFirstInvalidField();
      if (firstInvalid) {
        scrollToField(firstInvalid);
        focusField(firstInvalid);
      }
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
      goBackFromEditFlow();
    } catch (error) {
      console.error("Failed to update item", error);
      setActionableLoadError(error, t("item.edit.error.saveChanges"));
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
      setActionableLoadError(error, t("item.edit.error.addAttachment"));
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
      setActionableLoadError(error, t("item.edit.error.removeAttachment"));
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (name.length === 0) {
      setLoadError(t("item.form.error.categoryNameEmpty"));
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
      setActionableLoadError(error, t("item.form.error.createCategory"));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Box flex={1} alignItems="center" justifyContent="center" px="$5" py="$6">
          <VStack space="md" alignItems="center">
            <Spinner size="large" />
            <Text size="sm">{t("item.edit.loading")}</Text>
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
            <Heading size="xl">{t("item.edit.title")}</Heading>
            <Card borderWidth="$1" borderColor="$error300">
              <VStack space="sm">
                <Text bold size="md">
                  {t("item.edit.couldNotLoad")}
                </Text>
                <Text size="sm">{loadError ?? t("item.detail.notFound")}</Text>
                <HStack space="sm" flexWrap="wrap">
                  <Button variant="outline" action="secondary" onPress={() => void loadEditData()}>
                    <ButtonText>{t("common.action.retry")}</ButtonText>
                  </Button>
                  {showOpenSettingsAction ? (
                    <Button
                      variant="outline"
                      action="secondary"
                      onPress={() => void openDeviceSettings()}
                    >
                      <ButtonText>{t("common.action.openSettings")}</ButtonText>
                    </Button>
                  ) : null}
                </HStack>
              </VStack>
            </Card>
            <Button variant="outline" action="secondary" onPress={() => router.replace("/(tabs)/items")}>
              <ButtonText>{t("common.action.backToItems")}</ButtonText>
            </Button>
          </VStack>
        </Box>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Box flex={1} px="$5">
        <ScrollView
          ref={scrollRef}
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
          <VStack space="lg">
          <VStack space="xs">
            <Heading size="2xl">{t("item.edit.title")}</Heading>
            <Text size="sm">
              {t("item.edit.subtitle", { title: item.title })}
            </Text>
          </VStack>

          {loadError ? (
            <Card borderWidth="$1" borderColor="$error300">
              <VStack space="sm">
                <Text size="sm">{loadError}</Text>
                <HStack space="sm" flexWrap="wrap">
                  <Button variant="outline" action="secondary" onPress={() => void loadEditData()}>
                    <ButtonText>{t("common.action.retry")}</ButtonText>
                  </Button>
                  {showOpenSettingsAction ? (
                    <Button
                      variant="outline"
                      action="secondary"
                      onPress={() => void openDeviceSettings()}
                    >
                      <ButtonText>{t("common.action.openSettings")}</ButtonText>
                    </Button>
                  ) : null}
                </HStack>
              </VStack>
            </Card>
          ) : null}

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <Heading size="md">{t("item.edit.section.fields")}</Heading>

              <Box
                testID="edititem-input-title"
                onLayout={(event) => {
                  fieldYRef.current.title = event.nativeEvent.layout.y;
                }}
              >
              <VStack space="xs">
                <Text bold size="sm">
                  {t("item.form.titleRequired")}
                </Text>
                <Input
                  variant="outline"
                  borderColor={shouldShowFieldError("title") ? "$error600" : "$border200"}
                >
                  <InputField
                    ref={(node) => {
                      inputRef.current.title = node as FocusTarget | null;
                    }}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t("item.form.titlePlaceholder")}
                    onBlur={() => setFieldTouched("title")}
                    testID="item-edit-title-input"
                    accessibilityLabel={t("item.form.accessibility.title")}
                    accessibilityState={
                      ({ invalid: shouldShowFieldError("title") } as any)
                    }
                  />
                </Input>
                {shouldShowFieldError("title") ? (
                  <Text
                    size="xs"
                    color="$error600"
                    testID="edititem-error-title"
                    accessibilityLiveRegion="polite"
                  >
                    {validationMessages.title}
                  </Text>
                ) : null}
              </VStack>
              </Box>

              <Box
                testID="edititem-input-purchaseDate"
                onLayout={(event) => {
                  fieldYRef.current.purchaseDate = event.nativeEvent.layout.y;
                }}
              >
              <VStack space="xs">
                <Text bold size="sm">
                  {t("item.form.purchaseDateRequired")}
                </Text>
                <HStack space="sm" flexWrap="wrap" alignItems="center">
                  <Pressable
                    onPress={openPurchaseDatePicker}
                    testID="item-edit-purchase-date-input"
                    accessibilityRole="button"
                    accessibilityLabel={t("item.form.accessibility.purchaseDate")}
                    accessibilityState={
                      ({ invalid: shouldShowFieldError("purchaseDate") } as any)
                    }
                    style={{ flex: 1, minWidth: 180 }}
                  >
                    <Box
                      borderWidth="$1"
                      borderColor={shouldShowFieldError("purchaseDate") ? "$error600" : "$border200"}
                      style={{
                        borderRadius: 8,
                        minHeight: 44,
                        paddingHorizontal: 12,
                        justifyContent: "center",
                      }}
                    >
                      <HStack justifyContent="space-between" alignItems="center" space="sm">
                        <Text>{purchaseDate}</Text>
                        <Calendar size={18} color={theme.textSecondary} />
                      </HStack>
                    </Box>
                  </Pressable>
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => setPurchaseDate(formatYmdFromDateLocal(new Date()))}
                  >
                    <ButtonText>{t("item.form.setToday")}</ButtonText>
                  </Button>
                </HStack>
                {shouldShowFieldError("purchaseDate") ? (
                  <Text
                    size="xs"
                    color="$error600"
                    testID="edititem-error-purchaseDate"
                    accessibilityLiveRegion="polite"
                  >
                    {validationMessages.purchaseDate}
                  </Text>
                ) : null}
                {Platform.OS === "ios" && isDatePickerOpen && iosSwiftUI ? (
                  <Card
                    borderWidth="$1"
                    borderColor="$border200"
                    style={{ backgroundColor: theme.background }}
                  >
                    <VStack space="sm">
                      <iosSwiftUI.Host matchContents colorScheme={colorScheme}>
                        <iosSwiftUI.DatePicker
                          title={t("item.form.selectPurchaseDate")}
                          selection={datePickerValue}
                          displayedComponents={["date"]}
                          modifiers={[iosSwiftUI.datePickerStyle("wheel")]}
                          onDateChange={onIosPurchaseDateChange}
                        />
                      </iosSwiftUI.Host>
                      <HStack justifyContent="flex-end" space="sm">
                        <Button
                          size="sm"
                          variant="outline"
                          action="secondary"
                          onPress={closePurchaseDatePicker}
                          accessibilityLabel={t("item.form.accessibility.cancelDateSelection")}
                        >
                          <ButtonText>{t("common.action.cancel")}</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          onPress={confirmPurchaseDatePicker}
                          accessibilityLabel={t("item.form.accessibility.confirmDateSelection")}
                        >
                          <ButtonText>{t("common.action.done")}</ButtonText>
                        </Button>
                      </HStack>
                    </VStack>
                  </Card>
                ) : null}
                {Platform.OS === "ios" && isDatePickerOpen && !iosSwiftUI ? (
                  <Card
                    borderWidth="$1"
                    borderColor="$border200"
                    style={{ backgroundColor: theme.background }}
                  >
                    <VStack space="sm">
                      <Heading size="sm">{t("item.form.selectPurchaseDate")}</Heading>
                      <DateTimePicker
                        mode="date"
                        value={datePickerValue}
                        display="spinner"
                        themeVariant={colorScheme}
                        textColor={theme.text}
                        onChange={onIosFallbackPurchaseDatePickerChange}
                      />
                      <HStack justifyContent="flex-end" space="sm">
                        <Button
                          size="sm"
                          variant="outline"
                          action="secondary"
                          onPress={closePurchaseDatePicker}
                          accessibilityLabel={t("item.form.accessibility.cancelDateSelection")}
                        >
                          <ButtonText>{t("common.action.cancel")}</ButtonText>
                        </Button>
                        <Button
                          size="sm"
                          onPress={confirmPurchaseDatePicker}
                          accessibilityLabel={t("item.form.accessibility.confirmDateSelection")}
                        >
                          <ButtonText>{t("common.action.done")}</ButtonText>
                        </Button>
                      </HStack>
                    </VStack>
                  </Card>
                ) : null}
              </VStack>
              </Box>

              <Box
                testID="edititem-input-price"
                onLayout={(event) => {
                  fieldYRef.current.totalCents = event.nativeEvent.layout.y;
                }}
              >
              <VStack space="xs">
                <Text bold size="sm">
                  {t("item.form.priceRequired")}
                </Text>
                <Input
                  variant="outline"
                  borderColor={shouldShowFieldError("totalCents") ? "$error600" : "$border200"}
                >
                  <InputField
                    ref={(node) => {
                      inputRef.current.totalCents = node as FocusTarget | null;
                    }}
                    value={totalPrice}
                    onChangeText={setTotalPrice}
                    keyboardType="decimal-pad"
                    placeholder={t("item.form.pricePlaceholder")}
                    onBlur={() => setFieldTouched("totalCents")}
                    testID="item-edit-total-price-input"
                    accessibilityLabel={t("item.form.accessibility.price")}
                    accessibilityState={
                      ({ invalid: shouldShowFieldError("totalCents") } as any)
                    }
                  />
                </Input>
                {shouldShowFieldError("totalCents") ? (
                  <Text
                    size="xs"
                    color="$error600"
                    testID="edititem-error-price"
                    accessibilityLiveRegion="polite"
                  >
                    {validationMessages.totalCents}
                  </Text>
                ) : null}
              </VStack>
              </Box>

              <VStack space="xs" testID="edititem-input-category">
                <Text bold size="sm">
                  {t("item.form.category")}
                </Text>
                <Button
                  variant="outline"
                  action="secondary"
                  justifyContent="space-between"
                  onPress={() => setIsCategorySheetOpen(true)}
                  testID="item-edit-category-open"
                  accessibilityLabel={t("item.form.accessibility.selectCategory")}
                >
                  <ButtonText>{selectedCategoryName}</ButtonText>
                </Button>
                <HStack space="sm" flexWrap="wrap" alignItems="center">
                  <Input variant="outline" flex={1} minWidth={200}>
                    <InputField
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      placeholder={t("item.form.createCategoryPlaceholder")}
                      testID="item-edit-category-create-input"
                      accessibilityLabel={t("item.form.accessibility.createCategory")}
                    />
                  </Input>
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => void createCategory()}
                    disabled={isCreatingCategory}
                    testID="item-edit-category-create-button"
                    accessibilityLabel={t("item.form.accessibility.addCategory")}
                  >
                    <ButtonText>{isCreatingCategory ? t("item.form.creatingCategory") : t("common.action.add")}</ButtonText>
                  </Button>
                </HStack>
              </VStack>

              <VStack space="xs" testID="edititem-input-usageType">
                <Text bold size="sm">
                  {t("item.form.usageTypeRequired")}
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
                      accessibilityLabel={t("item.form.accessibility.usageType", {
                        usageType: option.label,
                      })}
                    >
                      <ButtonText>{option.label}</ButtonText>
                    </Button>
                  ))}
                </HStack>
                <Text size="xs" color="$textLight500" testID="edititem-usage-workshare">
                  {t("item.edit.workUsageApplied", {
                    percent: resolvedWorkUsagePercent,
                  })}
                </Text>
              </VStack>

              {usageType === "MIXED" ? (
                <Box
                  testID="edititem-input-workpercent"
                  onLayout={(event) => {
                    fieldYRef.current.workPercent = event.nativeEvent.layout.y;
                  }}
                >
                <VStack space="xs">
                  <Text bold size="sm">
                    {t("item.form.workPercentRequired")}
                  </Text>
                  <Input
                    variant="outline"
                    borderColor={shouldShowFieldError("workPercent") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.workPercent = node as FocusTarget | null;
                      }}
                      value={workPercent}
                      onChangeText={setWorkPercent}
                      keyboardType="number-pad"
                      placeholder={t("item.form.workPercentPlaceholder")}
                      onBlur={() => setFieldTouched("workPercent")}
                      testID="item-edit-work-percent-input"
                      accessibilityLabel={t("item.form.accessibility.workPercent")}
                      accessibilityState={
                        ({ invalid: shouldShowFieldError("workPercent") } as any)
                      }
                    />
                  </Input>
                  {shouldShowFieldError("workPercent") ? (
                    <Text
                      size="xs"
                      color="$error600"
                      testID="edititem-error-workpercent"
                      accessibilityLiveRegion="polite"
                    >
                      {validationMessages.workPercent}
                    </Text>
                  ) : null}
                </VStack>
                </Box>
              ) : null}

              <Box
                testID="edititem-input-warrantymonths"
                onLayout={(event) => {
                  fieldYRef.current.warrantyMonths = event.nativeEvent.layout.y;
                }}
              >
              <VStack space="xs">
                <Text bold size="sm">
                  {t("item.form.warrantyMonths")}
                </Text>
                <Input
                  variant="outline"
                  borderColor={shouldShowFieldError("warrantyMonths") ? "$error600" : "$border200"}
                >
                  <InputField
                    ref={(node) => {
                      inputRef.current.warrantyMonths = node as FocusTarget | null;
                    }}
                    value={warrantyMonths}
                    onChangeText={setWarrantyMonths}
                    keyboardType="number-pad"
                    placeholder={t("item.form.optionalPlaceholder")}
                    onBlur={() => setFieldTouched("warrantyMonths")}
                    testID="item-edit-warranty-months-input"
                    accessibilityLabel={t("item.form.accessibility.warrantyMonths")}
                    accessibilityState={
                      ({ invalid: shouldShowFieldError("warrantyMonths") } as any)
                    }
                  />
                </Input>
                {shouldShowFieldError("warrantyMonths") ? (
                  <Text
                    size="xs"
                    color="$error600"
                    testID="edititem-error-warrantymonths"
                    accessibilityLiveRegion="polite"
                  >
                    {validationMessages.warrantyMonths}
                  </Text>
                ) : null}
                <Text size="xs" color="$textLight500">
                  {t("item.form.warrantyUntil", {
                    date:
                      parsedWarrantyMonths && parsedWarrantyMonths > 0
                        ? (addMonthsToYmd(purchaseDate, parsedWarrantyMonths) ??
                          t("settings.taxCalculation.notAvailable"))
                        : t("settings.taxCalculation.notAvailable"),
                  })}
                </Text>
              </VStack>
              </Box>

              <VStack space="xs" testID="edititem-input-vendor">
                <Text bold size="sm">
                  {t("item.form.vendor")}
                </Text>
                <Input variant="outline">
                  <InputField
                    value={vendor}
                    onChangeText={setVendor}
                    placeholder={t("item.form.vendorPlaceholder")}
                    testID="item-edit-vendor-input"
                    accessibilityLabel={t("item.form.accessibility.vendor")}
                  />
                </Input>
              </VStack>

              <Box
                testID="edititem-input-usefullife"
                onLayout={(event) => {
                  fieldYRef.current.usefulLifeMonthsOverride = event.nativeEvent.layout.y;
                }}
              >
              <VStack space="xs">
                <Text bold size="sm">
                  {t("item.form.usefulLifeOverride")}
                </Text>
                <Input
                  variant="outline"
                  borderColor={showUsefulLifeError ? "$error600" : "$border200"}
                >
                  <InputField
                    ref={(node) => {
                      inputRef.current.usefulLifeMonthsOverride = node as FocusTarget | null;
                    }}
                    value={usefulLifeMonthsOverride}
                    onChangeText={setUsefulLifeMonthsOverride}
                    keyboardType="number-pad"
                    placeholder={t("item.form.usefulLifePlaceholder")}
                    onBlur={() => setFieldTouched("usefulLifeMonthsOverride")}
                    testID="item-edit-useful-life-input"
                    accessibilityLabel={t("item.form.accessibility.usefulLifeOverride")}
                    accessibilityState={
                      ({ invalid: showUsefulLifeError } as any)
                    }
                  />
                </Input>
                {showUsefulLifeError ? (
                  <Text
                    size="xs"
                    color="$error600"
                    testID="edititem-error-usefullife"
                    accessibilityLiveRegion="polite"
                  >
                    {usefulLifeMonthsOverrideError}
                  </Text>
                ) : null}
              </VStack>
              </Box>

              <VStack space="xs" testID="edititem-input-notes">
                <Text bold size="sm">
                  {t("item.form.notes")}
                </Text>
                <Textarea>
                  <TextareaInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder={t("item.form.notesPlaceholder")}
                    testID="item-edit-notes-input"
                    accessibilityLabel={t("item.form.accessibility.notes")}
                  />
                </Textarea>
                <Text size="xs" color="$textLight500">
                  {t("item.form.notesHint")}
                </Text>
              </VStack>
            </VStack>
          </Card>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <Heading size="md">{t("item.attachments.title")}</Heading>
              <HStack space="sm" flexWrap="wrap">
                <Button
                  variant="outline"
                  action="secondary"
                  disabled={isAttachmentBusy}
                  onPress={() => void addAttachment("receipt_camera")}
                  accessibilityLabel={t("item.attachments.accessibility.addReceipt")}
                >
                  <ButtonText>
                    {isAttachmentBusy
                      ? t("settings.backupSync.localBackup.working")
                      : t("item.edit.action.addReceiptPhoto")}
                  </ButtonText>
                </Button>
                <Button
                  variant="outline"
                  action="secondary"
                  disabled={isAttachmentBusy}
                  onPress={() => void addAttachment("receipt_upload")}
                  accessibilityLabel={t("item.attachments.accessibility.uploadFile")}
                >
                  <ButtonText>
                    {isAttachmentBusy
                      ? t("settings.backupSync.localBackup.working")
                      : t("item.edit.action.uploadReceipt")}
                  </ButtonText>
                </Button>
                <Button
                  variant="outline"
                  action="secondary"
                  disabled={isAttachmentBusy}
                  onPress={() => void addAttachment("photo_camera")}
                  accessibilityLabel={t("item.attachments.accessibility.addExtraPhoto")}
                >
                  <ButtonText>
                    {isAttachmentBusy
                      ? t("settings.backupSync.localBackup.working")
                      : t("item.edit.action.addExtraPhoto")}
                  </ButtonText>
                </Button>
              </HStack>

              {attachments.length === 0 ? (
                <Card borderWidth="$1" borderColor="$border200">
                  <Text size="sm">{t("item.edit.attachments.empty")}</Text>
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
                              accessibilityLabel={t("item.attachments.accessibility.remove", {
                                fileName: attachment.originalFileName ?? t("item.attachments.unnamedFile"),
                              })}
                            >
                              <ButtonText>{t("common.action.remove")}</ButtonText>
                            </Button>
                          </HStack>

                          {missing ? (
                            <Card borderWidth="$1" borderColor="$warning300">
                              <Text size="sm">{t("item.edit.attachments.missingOnDisk")}</Text>
                            </Card>
                          ) : isImageAttachment(attachment) ? (
                            <Image
                              source={{ uri: attachmentPreviewUris[attachment.id] ?? attachment.filePath }}
                              style={{ width: "100%", height: 140, borderRadius: 8 }}
                              contentFit="cover"
                            />
                          ) : (
                            <Card borderWidth="$1" borderColor="$border200">
                              <Text size="sm">{t("item.edit.attachments.pdfAttached")}</Text>
                            </Card>
                          )}

                          {missing ? (
                            <Badge size="sm" action="warning" variant="outline" alignSelf="flex-start">
                              <BadgeText>{t("item.detail.missingFile")}</BadgeText>
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

          <VStack space="xs">
            <HStack justifyContent="space-between" alignItems="center" space="sm">
              <Box flex={1} testID="edititem-btn-cancel">
                <Button
                  flex={1}
                  variant="outline"
                  action="secondary"
                  onPress={handleExitRequest}
                  disabled={isActionBusy}
                  testID="edititem-cancel"
                  accessibilityLabel={t("item.edit.accessibility.cancel")}
                >
                  <ButtonText testID="item-edit-cancel">{t("common.action.cancel")}</ButtonText>
                </Button>
              </Box>
              <Box flex={1} testID="edititem-btn-submit">
                <Button
                  flex={1}
                  onPress={() => void saveChanges()}
                  disabled={isSaveDisabled}
                  testID="item-edit-save"
                  accessibilityLabel={t("item.edit.accessibility.save")}
                >
                  <ButtonText>
                    {isSaving ? t("onboarding.profileSetup.saving") : t("item.edit.action.saveChanges")}
                  </ButtonText>
                </Button>
              </Box>
            </HStack>
          </VStack>
          </VStack>
        </ScrollView>

        {Platform.OS === "android" && isDatePickerOpen && (
          <DateTimePicker
            mode="date"
            value={datePickerValue}
            display="default"
            onChange={onAndroidPurchaseDatePickerChange}
          />
        )}

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
              <ActionsheetItemText>{t("item.form.category.noneSelected")}</ActionsheetItemText>
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
                  <Heading size="md">{t("item.form.discard.title")}</Heading>
                  <Text size="sm">{t("item.form.discard.body")}</Text>
                </VStack>
                <HStack justifyContent="flex-end" space="sm">
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={closeDiscardModal}
                    testID="keep-editing"
                    accessibilityLabel={t("common.action.keepEditing")}
                  >
                    <ButtonText testID="item-edit-discard-keepediting">{t("common.action.keepEditing")}</ButtonText>
                  </Button>
                  <Button
                    size="sm"
                    action="negative"
                    onPress={goBackFromEditFlow}
                    testID="discard-confirm"
                    accessibilityLabel={t("item.form.discard.accessibilityDiscard")}
                  >
                    <ButtonText testID="item-edit-discard-confirm">{t("common.action.discard")}</ButtonText>
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
