import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { HeaderBackButton } from "@react-navigation/elements";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Actionsheet as GActionsheet,
  ActionsheetBackdrop as GActionsheetBackdrop,
  ActionsheetContent as GActionsheetContent,
  ActionsheetDragIndicator as GActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper as GActionsheetDragIndicatorWrapper,
  ActionsheetItem as GActionsheetItem,
  ActionsheetItemText as GActionsheetItemText,
  Box as GBox,
  Button as GButton,
  ButtonText as GButtonText,
  Card as GCard,
  Heading as GHeading,
  HStack as GHStack,
  Input as GInput,
  InputField as GInputField,
  Spinner as GSpinner,
  Text as GText,
  Textarea as GTextarea,
  TextareaInput as GTextareaInput,
  VStack as GVStack,
} from "@gluestack-ui/themed";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Upload,
  X,
} from "lucide-react-native";
import * as Sharing from "expo-sharing";

import { validateItemInput } from "@/domain/item-validation";
import { useTheme } from "@/hooks/use-theme";
import type { AttachmentType } from "@/models/attachment";
import type { Category } from "@/models/category";
import type { ItemUsageType } from "@/models/item";
import {
  getCategoryRepository,
  getItemRepository,
} from "@/repositories/create-core-repositories";
import type { StoredAttachmentFile } from "@/services/attachment-storage";
import { saveFromCamera, saveFromPicker } from "@/services/attachment-storage";
import {
  clearItemDraft,
  createItemDraft,
  getItemDraftAttachments,
  linkDraftAttachmentsToItem,
  addAttachmentToDraft,
  removeAttachmentFromDraft,
} from "@/services/item-draft-store";
import {
  friendlyFileErrorMessage,
  isUserCancellationError,
  shouldOfferOpenSettingsForError,
} from "@/services/friendly-errors";
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

function toSingleParam(
  value: string | string[] | undefined,
): string | undefined {
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

function withType(
  attachment: StoredAttachmentFile,
  type: AttachmentType,
): StoredAttachmentFile {
  return {
    ...attachment,
    type,
  };
}

function toAttachmentTestId(
  attachment: StoredAttachmentFile,
  index: number,
): string {
  const base =
    attachment.originalFileName ?? attachment.filePath ?? `attachment-${index}`;
  return `${index}-${base}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isPdfAttachment(attachment: StoredAttachmentFile): boolean {
  const mime = attachment.mimeType?.toLowerCase() ?? "";
  const name = attachment.originalFileName?.toLowerCase() ?? "";
  return mime.includes("pdf") || name.endsWith(".pdf");
}

function toLocalDateFromYmd(value: string): Date {
  const parsed = parseYmd(value);
  if (!parsed) {
    return new Date();
  }
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

const usageOptions: { value: ItemUsageType; label: string; key: string }[] = [
  { value: "WORK", label: "WORK", key: "work" },
  { value: "PRIVATE", label: "PRIVATE", key: "private" },
  { value: "MIXED", label: "MIXED", key: "mixed" },
  { value: "OTHER", label: "OTHER", key: "other" },
];

const requiredFieldMessages: Record<
  "title" | "purchaseDate" | "totalCents",
  string
> = {
  title: "Title is required.",
  purchaseDate: "Purchase date is required.",
  totalCents: "Price is required and must be greater than 0.",
};

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
  attachmentFingerprint: string;
}

type FocusTarget = {
  focus?: () => void;
};

export default function NewItemRoute() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = toSingleParam(params.draftId);
  const [generatedDraftId, setGeneratedDraftId] = useState<string | null>(null);
  const activeDraftId = draftId ?? generatedDraftId;
  const shouldCleanupDraftOnExitRef = useRef(true);
  const allowNavigationExitRef = useRef(false);
  const pendingNavigationActionRef = useRef<any | null>(null);
  const isDirtyRef = useRef(false);
  const isDiscardModalOpenRef = useRef(false);
  const fieldYRef = useRef<Partial<Record<FieldKey, number>>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const inputRef = useRef<Partial<Record<FieldKey, FocusTarget | null>>>({});
  const initialSnapshotCapturedRef = useRef(false);
  const initialSnapshotRef = useRef<InitialSnapshot | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<FieldKey, boolean>>
  >({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveFeedbackMessage, setSaveFeedbackMessage] = useState<string | null>(
    null,
  );
  const [showOpenSettingsAction, setShowOpenSettingsAction] = useState(false);
  const [attachments, setAttachments] = useState<StoredAttachmentFile[]>([]);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] =
    useState<StoredAttachmentFile | null>(null);

  const [title, setTitle] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    formatYmdFromDateLocal(new Date()),
  );
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isOptionalOpen, setIsOptionalOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const receiptAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.type === "RECEIPT"),
    [attachments],
  );
  const extraPhotos = useMemo(
    () => attachments.filter((attachment) => attachment.type === "PHOTO"),
    [attachments],
  );
  const attachmentFingerprint = useMemo(() => {
    return attachments
      .map((attachment) => `${attachment.filePath}|${attachment.type}`)
      .sort()
      .join("||");
  }, [attachments]);

  const parsedTotalCents = useMemo(
    () => parseEuroInputToCents(totalPrice),
    [totalPrice],
  );
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
    if (
      parsedUsefulLifeMonthsOverride === null ||
      parsedUsefulLifeMonthsOverride <= 0
    ) {
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
  }, [
    title,
    purchaseDate,
    parsedTotalCents,
    usageType,
    parsedWorkPercent,
    parsedWarrantyMonths,
  ]);

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
      title: fieldErrors.title ? requiredFieldMessages.title : undefined,
      purchaseDate: fieldErrors.purchaseDate
        ? purchaseDate.trim().length === 0
          ? requiredFieldMessages.purchaseDate
          : fieldErrors.purchaseDate
        : undefined,
      totalCents: fieldErrors.totalCents
        ? requiredFieldMessages.totalCents
        : undefined,
      workPercent: fieldErrors.workPercent,
      warrantyMonths: fieldErrors.warrantyMonths,
    };
  }, [fieldErrors, purchaseDate]);

  const isFormValid =
    validation.valid && usefulLifeMonthsOverrideError === null;
  const isSaveDisabled =
    (submitAttempted && !isFormValid) || isSavingItem || isBusy;

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) {
      return "No category selected";
    }
    return (
      categories.find((entry) => entry.id === categoryId)?.name ??
      "Unknown category"
    );
  }, [categories, categoryId]);

  const warrantyUntilDate = useMemo(() => {
    if (!parsedWarrantyMonths || parsedWarrantyMonths <= 0) {
      return null;
    }
    return addMonthsToYmd(purchaseDate, parsedWarrantyMonths);
  }, [parsedWarrantyMonths, purchaseDate]);

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
      attachmentFingerprint !== initial.attachmentFingerprint ||
      newCategoryName.trim().length > 0
    );
  }, [
    attachmentFingerprint,
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

  const setFieldTouched = useCallback((field: FieldKey) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }, []);

  const shouldShowFieldError = useCallback(
    (field: FieldKey) =>
      Boolean((submitAttempted || touchedFields[field]) && fieldErrors[field]),
    [fieldErrors, submitAttempted, touchedFields],
  );

  const showUsefulLifeError = Boolean(
    (submitAttempted || touchedFields.usefulLifeMonthsOverride) &&
    usefulLifeMonthsOverrideError,
  );

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
      } else if (
        categoryId &&
        !loaded.some((category) => category.id === categoryId)
      ) {
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
    if (activeDraftId) {
      reloadDraftAttachments(activeDraftId);
      setIsInitializing(false);
      void loadCategories();
      return;
    }

    const createdDraftId = createItemDraft();
    setGeneratedDraftId(createdDraftId);
  }, [activeDraftId, loadCategories, reloadDraftAttachments]);

  useEffect(() => {
    if (
      isInitializing ||
      !activeDraftId ||
      initialSnapshotCapturedRef.current
    ) {
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
      attachmentFingerprint,
    };
    initialSnapshotCapturedRef.current = true;
  }, [
    attachmentFingerprint,
    categoryId,
    activeDraftId,
    isInitializing,
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

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setShowOpenSettingsAction(false);
  }, []);

  const setActionableError = useCallback((error: unknown, fallback: string) => {
    setErrorMessage(friendlyFileErrorMessage(error, fallback));
    setShowOpenSettingsAction(shouldOfferOpenSettingsForError(error));
  }, []);

  const goBackFromAddFlow = useCallback(() => {
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

  const exitAfterDiscard = useCallback(async () => {
    if (!activeDraftId) {
      goBackFromAddFlow();
      return;
    }

    setIsBusy(true);
    clearError();
    try {
      await clearItemDraft(activeDraftId);
      shouldCleanupDraftOnExitRef.current = false;
      goBackFromAddFlow();
    } catch (error) {
      console.error("Failed to clear item draft", error);
      setActionableError(error, "Could not cancel draft safely. Please retry.");
    } finally {
      setIsBusy(false);
      setIsDiscardModalOpen(false);
    }
  }, [activeDraftId, clearError, goBackFromAddFlow, setActionableError]);

  const handleExitRequest = useCallback(async () => {
    pendingNavigationActionRef.current = null;
    if (!isDirty) {
      goBackFromAddFlow();
      return;
    }
    setIsDiscardModalOpen(true);
  }, [goBackFromAddFlow, isDirty]);

  const closeDiscardModal = useCallback(() => {
    pendingNavigationActionRef.current = null;
    setIsDiscardModalOpen(false);
  }, []);

  const openPurchaseDatePicker = useCallback(() => {
    setFieldTouched("purchaseDate");
    setDatePickerValue(toLocalDateFromYmd(purchaseDate));

    if (Platform.OS === "web") {
      const next = globalThis.prompt?.(
        "Enter purchase date (YYYY-MM-DD)",
        purchaseDate,
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
  }, [purchaseDate, setFieldTouched]);

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
    [],
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
    return () => {
      if (!activeDraftId || !shouldCleanupDraftOnExitRef.current) {
        return;
      }

      void clearItemDraft(activeDraftId).catch((error) => {
        console.error("Failed to clear draft during route exit cleanup", error);
      });
    };
  }, [activeDraftId]);

  useEffect(() => {
    const navigationWithOptions = navigation as {
      setOptions?: (options: {
        headerLeft?: (props: {
          canGoBack?: boolean;
          tintColor?: string;
        }) => React.ReactNode;
      }) => void;
    };
    if (typeof navigationWithOptions.setOptions !== "function") {
      return;
    }

    navigationWithOptions.setOptions({
      headerLeft: (props: { canGoBack?: boolean; tintColor?: string }) =>
        props.canGoBack ? (
          <HeaderBackButton
            testID="additem-header-back"
            tintColor={props.tintColor}
            onPress={() => {
              void handleExitRequest();
            }}
          />
        ) : null,
    });
  }, [handleExitRequest, navigation]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener(
        "beforeRemove",
        (event: any) => {
          if (allowNavigationExitRef.current || !isDirtyRef.current) {
            return;
          }

          event.preventDefault();
          pendingNavigationActionRef.current = event?.data?.action ?? null;
          setIsDiscardModalOpen(true);
        },
      );

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          pendingNavigationActionRef.current = null;
          if (isDiscardModalOpenRef.current) {
            closeDiscardModal();
            return true;
          }
          if (isDirtyRef.current) {
            setIsDiscardModalOpen(true);
            return true;
          }
          goBackFromAddFlow();
          return true;
        },
      );

      return () => {
        unsubscribe();
        subscription.remove();
      };
    }, [closeDiscardModal, goBackFromAddFlow, navigation]),
  );

  const openDeviceSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      setErrorMessage(
        "Could not open device settings. Open system settings manually.",
      );
      setShowOpenSettingsAction(false);
    }
  }, []);

  const handleOpenPdfAttachment = useCallback(
    async (attachment: StoredAttachmentFile) => {
      clearError();
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(attachment.filePath);
          return;
        }
        await Linking.openURL(attachment.filePath);
      } catch (error) {
        console.error("Failed to open PDF attachment", error);
        setActionableError(error, "Could not open PDF attachment.");
      }
    },
    [clearError, setActionableError],
  );

  const openAttachmentPreview = useCallback(
    (attachment: StoredAttachmentFile) => {
      if (isPdfAttachment(attachment)) {
        void handleOpenPdfAttachment(attachment);
        return;
      }
      setPreviewAttachment(attachment);
    },
    [handleOpenPdfAttachment],
  );

  const addReceiptFromCamera = async () => {
    if (!activeDraftId) {
      return;
    }

    setIsBusy(true);
    clearError();
    try {
      const captured = await saveFromCamera("draft");
      if (!captured) {
        return;
      }

      addAttachmentToDraft(activeDraftId, withType(captured, "RECEIPT"));
      reloadDraftAttachments(activeDraftId);
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
    if (!activeDraftId) {
      return;
    }

    setIsBusy(true);
    clearError();
    try {
      const picked = await saveFromPicker("draft");
      if (!picked) {
        return;
      }

      addAttachmentToDraft(activeDraftId, withType(picked, "RECEIPT"));
      reloadDraftAttachments(activeDraftId);
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
    if (!activeDraftId) {
      return;
    }

    setIsBusy(true);
    clearError();
    try {
      const captured = await saveFromCamera("draft");
      if (!captured) {
        return;
      }

      addAttachmentToDraft(activeDraftId, withType(captured, "PHOTO"));
      reloadDraftAttachments(activeDraftId);
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
    if (!activeDraftId) {
      return;
    }

    try {
      await removeAttachmentFromDraft(activeDraftId, filePath);
      reloadDraftAttachments(activeDraftId);
      if (previewAttachment?.filePath === filePath) {
        setPreviewAttachment(null);
      }
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

  const saveItem = async () => {
    if (!activeDraftId || !isFormValid || parsedTotalCents === null) {
      return;
    }

    setIsSavingItem(true);
    setSaveFeedbackMessage(null);
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
          parsedUsefulLifeMonthsOverride !== null &&
          parsedUsefulLifeMonthsOverride > 0
            ? parsedUsefulLifeMonthsOverride
            : null,
      });

      await linkDraftAttachmentsToItem(activeDraftId, created.id);
      shouldCleanupDraftOnExitRef.current = false;
      allowNavigationExitRef.current = true;
      setSaveFeedbackMessage("Saved");
      await new Promise((resolve) => setTimeout(resolve, 600));
      router.replace("/(tabs)/items");
    } catch (error) {
      console.error("Failed to save item", error);
      setSaveFeedbackMessage(null);
      setActionableError(error, "Could not save item. Please retry.");
    } finally {
      setIsSavingItem(false);
    }
  };

  const submitAndSave = async () => {
    setSubmitAttempted(true);
    if (!isFormValid) {
      const firstInvalid = getFirstInvalidField();
      if (firstInvalid) {
        scrollToField(firstInvalid);
        focusField(firstInvalid);
      }
      return;
    }
    await saveItem();
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <GBox
          flex={1}
          alignItems="center"
          justifyContent="center"
          px="$5"
          py="$6"
        >
          <GVStack space="md" alignItems="center">
            <GSpinner size="large" />
            <GText size="sm">Preparing item draft...</GText>
          </GVStack>
        </GBox>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <GBox flex={1}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            contentContainerStyle={{
              width: "100%",
              maxWidth: 860,
              alignSelf: "center",
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: insets.bottom + 24,
            }}
          >
            <GVStack space="lg">
              <GVStack space="xs">
                <GText size="sm">
                  Capture purchase data and receipts in one clean flow.
                </GText>
              </GVStack>

              {errorMessage && (
                <GCard
                  borderWidth="$1"
                  borderColor="$error300"
                  style={{
                    backgroundColor: theme.backgroundElement,
                    borderRadius: 14,
                  }}
                >
                  <GVStack space="sm">
                    <GText size="sm">{errorMessage}</GText>
                    {showOpenSettingsAction && (
                      <GButton
                        variant="outline"
                        action="secondary"
                        alignSelf="flex-start"
                        onPress={() => void openDeviceSettings()}
                        testID="new-item-open-settings"
                        accessibilityLabel="Open device settings"
                      >
                        <GButtonText>Open Settings</GButtonText>
                      </GButton>
                    )}
                  </GVStack>
                </GCard>
              )}

              <GCard
                borderWidth="$1"
                borderColor="$border200"
                style={{
                  backgroundColor: theme.backgroundElement,
                  borderRadius: 16,
                }}
              >
                <GVStack space="md">
                  <GHeading size="md">Attachments</GHeading>
                  <GHStack space="sm">
                    <GButton
                      flex={1}
                      variant="outline"
                      action="secondary"
                      onPress={() => void addReceiptFromCamera()}
                      disabled={isBusy}
                      testID="additem-btn-takephoto"
                      accessibilityLabel="Take photo"
                    >
                      <GHStack space="xs" alignItems="center">
                        <Plus size={16} color={theme.text} />
                        <GButtonText>Take photo</GButtonText>
                      </GHStack>
                    </GButton>
                    <GButton
                      flex={1}
                      variant="outline"
                      action="secondary"
                      onPress={() => void uploadReceipt()}
                      disabled={isBusy}
                      testID="additem-btn-upload"
                      accessibilityLabel="Upload PDF or image"
                    >
                      <GHStack space="xs" alignItems="center">
                        <Upload size={16} color={theme.text} />
                        <GButtonText>Upload PDF/Image</GButtonText>
                      </GHStack>
                    </GButton>
                  </GHStack>
                  <GButton
                    size="sm"
                    variant="link"
                    action="secondary"
                    alignSelf="flex-start"
                    onPress={() => void addExtraPhoto()}
                    disabled={isBusy}
                    testID="additem-btn-addextraphto"
                    accessibilityLabel="Add extra photo"
                  >
                    <GButtonText>
                      {isBusy ? "Working..." : "Add extra photo"}
                    </GButtonText>
                  </GButton>

                  <GText size="xs" color="$textLight500">
                    Receipts: {receiptAttachments.length} | Extra photos:{" "}
                    {extraPhotos.length}
                  </GText>

                  {attachments.length === 0 ? (
                    <GText size="sm" color="$textLight500">
                      No attachments yet. You can still save and add files
                      later.
                    </GText>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <GHStack space="sm">
                        {attachments.map((attachment, index) => {
                          const attachmentId = toAttachmentTestId(
                            attachment,
                            index,
                          );
                          const pdf = isPdfAttachment(attachment);
                          return (
                            <GBox key={attachment.filePath} width={136}>
                              <Pressable
                                onPress={() =>
                                  openAttachmentPreview(attachment)
                                }
                                testID={`additem-attachment-preview-${attachmentId}`}
                                accessibilityLabel={`Preview attachment ${attachment.originalFileName ?? "file"}`}
                              >
                                <GCard
                                  borderWidth="$1"
                                  borderColor="$border200"
                                  style={{
                                    backgroundColor: theme.background,
                                    borderRadius: 12,
                                    padding: 10,
                                    height: 120,
                                  }}
                                  testID={`additem-attachment-thumb-${attachmentId}`}
                                >
                                  <GVStack space="xs" flex={1}>
                                    <GBox
                                      height={64}
                                      borderWidth="$1"
                                      borderColor="$border200"
                                      style={{
                                        borderRadius: 10,
                                        overflow: "hidden",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        backgroundColor:
                                          theme.backgroundElement,
                                      }}
                                    >
                                      {pdf ? (
                                        <GVStack space="xs" alignItems="center">
                                          <FileText
                                            size={20}
                                            color={theme.textSecondary}
                                          />
                                          <GText size="xs">PDF</GText>
                                        </GVStack>
                                      ) : (
                                        <Image
                                          source={{ uri: attachment.filePath }}
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                          }}
                                          resizeMode="cover"
                                        />
                                      )}
                                    </GBox>
                                    <GText size="xs" numberOfLines={1}>
                                      {attachment.originalFileName ??
                                        "Unnamed file"}
                                    </GText>
                                    <GText size="xs" color="$textLight500">
                                      {formatFileSize(attachment.fileSizeBytes)}
                                    </GText>
                                  </GVStack>
                                </GCard>
                              </Pressable>
                              <Pressable
                                onPress={() =>
                                  void removeAttachment(attachment.filePath)
                                }
                                testID={`additem-attachment-remove-${attachmentId}`}
                                accessibilityLabel={`Remove attachment ${attachment.originalFileName ?? "file"}`}
                                style={{
                                  position: "absolute",
                                  top: -10,
                                  right: -10,
                                  width: 44,
                                  height: 44,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <GBox
                                  borderWidth="$1"
                                  borderColor="$border200"
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: theme.background,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <X size={14} color={theme.text} />
                                </GBox>
                              </Pressable>
                            </GBox>
                          );
                        })}
                      </GHStack>
                    </ScrollView>
                  )}
                </GVStack>
              </GCard>

              <GCard
                borderWidth="$1"
                borderColor="$border200"
                style={{
                  backgroundColor: theme.backgroundElement,
                  borderRadius: 16,
                }}
              >
                <GVStack space="md">
                  <GHeading size="md">Required</GHeading>

                  <GBox
                    onLayout={(event) => {
                      fieldYRef.current.title = event.nativeEvent.layout.y;
                    }}
                  >
                    <GVStack space="xs">
                      <GText bold size="sm">
                        Title
                      </GText>
                      <GInput
                        variant="outline"
                        borderColor={
                          shouldShowFieldError("title")
                            ? "$error600"
                            : "$border200"
                        }
                      >
                        <GInputField
                          ref={(node) => {
                            inputRef.current.title = node as FocusTarget | null;
                          }}
                          value={title}
                          onChangeText={setTitle}
                          placeholder="e.g. Laptop for work"
                          onBlur={() => setFieldTouched("title")}
                          testID="additem-input-title"
                          accessibilityLabel="Item title"
                          accessibilityState={
                            { invalid: shouldShowFieldError("title") } as any
                          }
                        />
                      </GInput>
                      {shouldShowFieldError("title") && (
                        <GText
                          size="xs"
                          color="$error600"
                          accessibilityLiveRegion="polite"
                          testID="additem-error-title"
                        >
                          {validationMessages.title}
                        </GText>
                      )}
                    </GVStack>
                  </GBox>

                  <GBox
                    onLayout={(event) => {
                      fieldYRef.current.purchaseDate =
                        event.nativeEvent.layout.y;
                    }}
                  >
                    <GVStack space="xs">
                      <GHStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <GText bold size="sm">
                          Purchase date
                        </GText>
                        <GButton
                          size="xs"
                          variant="outline"
                          action="secondary"
                          onPress={() =>
                            setPurchaseDate(formatYmdFromDateLocal(new Date()))
                          }
                          testID="additem-btn-settoday"
                          accessibilityLabel="Set purchase date to today"
                        >
                          <GButtonText>Set today</GButtonText>
                        </GButton>
                      </GHStack>
                      <Pressable
                        onPress={openPurchaseDatePicker}
                        testID="additem-input-purchaseDate"
                        accessibilityRole="button"
                        accessibilityLabel="Purchase date"
                        accessibilityState={
                          {
                            invalid: shouldShowFieldError("purchaseDate"),
                          } as any
                        }
                      >
                        <GBox
                          borderWidth="$1"
                          borderColor={
                            shouldShowFieldError("purchaseDate")
                              ? "$error600"
                              : "$border200"
                          }
                          style={{
                            borderRadius: 8,
                            minHeight: 44,
                            paddingHorizontal: 12,
                            justifyContent: "center",
                          }}
                        >
                          <GHStack
                            justifyContent="space-between"
                            alignItems="center"
                            space="sm"
                          >
                            <GText>{purchaseDate}</GText>
                            <Calendar size={18} color={theme.textSecondary} />
                          </GHStack>
                        </GBox>
                      </Pressable>
                      {shouldShowFieldError("purchaseDate") && (
                        <GText
                          size="xs"
                          color="$error600"
                          accessibilityLiveRegion="polite"
                          testID="additem-error-purchaseDate"
                        >
                          {validationMessages.purchaseDate}
                        </GText>
                      )}
                      {Platform.OS === "ios" && isDatePickerOpen && iosSwiftUI && (
                        <GCard
                          borderWidth="$1"
                          borderColor="$border200"
                          style={{ backgroundColor: theme.background }}
                        >
                          <GVStack space="sm">
                            <iosSwiftUI.Host matchContents>
                              <iosSwiftUI.DatePicker
                                title="Select purchase date"
                                selection={datePickerValue}
                                displayedComponents={["date"]}
                                modifiers={[iosSwiftUI.datePickerStyle("wheel")]}
                                onDateChange={onIosPurchaseDateChange}
                              />
                            </iosSwiftUI.Host>
                            <GHStack justifyContent="flex-end" space="sm">
                              <GButton
                                size="sm"
                                variant="outline"
                                action="secondary"
                                onPress={closePurchaseDatePicker}
                                accessibilityLabel="Cancel date selection"
                              >
                                <GButtonText>Cancel</GButtonText>
                              </GButton>
                              <GButton
                                size="sm"
                                onPress={confirmPurchaseDatePicker}
                                accessibilityLabel="Confirm date selection"
                              >
                                <GButtonText>Done</GButtonText>
                              </GButton>
                            </GHStack>
                          </GVStack>
                        </GCard>
                      )}
                      {Platform.OS === "ios" && isDatePickerOpen && !iosSwiftUI && (
                        <GCard
                          borderWidth="$1"
                          borderColor="$border200"
                          style={{ backgroundColor: theme.background }}
                        >
                          <GVStack space="sm">
                            <GHeading size="sm">Select purchase date</GHeading>
                            <DateTimePicker
                              mode="date"
                              value={datePickerValue}
                              display="spinner"
                              onChange={onIosFallbackPurchaseDatePickerChange}
                            />
                            <GHStack justifyContent="flex-end" space="sm">
                              <GButton
                                size="sm"
                                variant="outline"
                                action="secondary"
                                onPress={closePurchaseDatePicker}
                                accessibilityLabel="Cancel date selection"
                              >
                                <GButtonText>Cancel</GButtonText>
                              </GButton>
                              <GButton
                                size="sm"
                                onPress={confirmPurchaseDatePicker}
                                accessibilityLabel="Confirm date selection"
                              >
                                <GButtonText>Done</GButtonText>
                              </GButton>
                            </GHStack>
                          </GVStack>
                        </GCard>
                      )}
                    </GVStack>
                  </GBox>

                  <GBox
                    onLayout={(event) => {
                      fieldYRef.current.totalCents = event.nativeEvent.layout.y;
                    }}
                  >
                    <GVStack space="xs">
                      <GText bold size="sm">
                        Price (EUR)
                      </GText>
                      <GInput
                        variant="outline"
                        borderColor={
                          shouldShowFieldError("totalCents")
                            ? "$error600"
                            : "$border200"
                        }
                      >
                        <GInputField
                          ref={(node) => {
                            inputRef.current.totalCents =
                              node as FocusTarget | null;
                          }}
                          value={totalPrice}
                          onChangeText={setTotalPrice}
                          keyboardType="decimal-pad"
                          placeholder="e.g. 1299.90"
                          onBlur={() => setFieldTouched("totalCents")}
                          testID="additem-input-price"
                          accessibilityLabel="Price in euros"
                          accessibilityState={
                            {
                              invalid: shouldShowFieldError("totalCents"),
                            } as any
                          }
                        />
                      </GInput>
                      {shouldShowFieldError("totalCents") && (
                        <GText
                          size="xs"
                          color="$error600"
                          accessibilityLiveRegion="polite"
                          testID="additem-error-price"
                        >
                          {validationMessages.totalCents}
                        </GText>
                      )}
                    </GVStack>
                  </GBox>

                  <GVStack space="xs">
                    <GText bold size="sm">
                      Category
                    </GText>
                    <GButton
                      variant="outline"
                      action="secondary"
                      onPress={() => setIsCategorySheetOpen(true)}
                      justifyContent="space-between"
                      testID="additem-select-category"
                      accessibilityLabel="Select category"
                    >
                      <GButtonText>{selectedCategoryName}</GButtonText>
                    </GButton>
                    {isLoadingCategories && (
                      <GHStack space="sm" alignItems="center">
                        <GSpinner size="small" />
                        <GText size="xs">Loading categories...</GText>
                      </GHStack>
                    )}
                  </GVStack>

                  <GVStack space="xs">
                    <GText size="xs" color="$textLight500">
                      Create new category
                    </GText>
                    <GHStack space="sm" alignItems="center">
                      <GInput variant="outline" flex={1}>
                        <GInputField
                          value={newCategoryName}
                          onChangeText={setNewCategoryName}
                          placeholder="e.g. Office equipment"
                          testID="additem-input-newcategory"
                          accessibilityLabel="Create new category"
                        />
                      </GInput>
                      <GButton
                        size="sm"
                        variant="outline"
                        action="secondary"
                        onPress={() => void createCategory()}
                        disabled={isCreatingCategory}
                        testID="additem-btn-addcategory"
                        accessibilityLabel="Add category"
                      >
                        <GButtonText>
                          {isCreatingCategory ? "Adding..." : "Add"}
                        </GButtonText>
                      </GButton>
                    </GHStack>
                  </GVStack>

                  <GVStack space="xs">
                    <GText bold size="sm">
                      Usage type
                    </GText>
                    <GHStack space="sm" flexWrap="wrap">
                      {usageOptions.map((option) => (
                        <GButton
                          key={option.value}
                          size="sm"
                          variant={
                            usageType === option.value ? "solid" : "outline"
                          }
                          action={
                            usageType === option.value ? "primary" : "secondary"
                          }
                          onPress={() => setUsageType(option.value)}
                          testID={`additem-seg-usage-${option.key}`}
                          accessibilityLabel={`Usage type ${option.label}`}
                        >
                          <GButtonText>{option.label}</GButtonText>
                        </GButton>
                      ))}
                    </GHStack>
                  </GVStack>

                  {usageType === "MIXED" && (
                    <GBox
                      onLayout={(event) => {
                        fieldYRef.current.workPercent =
                          event.nativeEvent.layout.y;
                      }}
                    >
                      <GVStack space="xs">
                        <GText bold size="sm">
                          Work percent (%)
                        </GText>
                        <GInput
                          variant="outline"
                          borderColor={
                            shouldShowFieldError("workPercent")
                              ? "$error600"
                              : "$border200"
                          }
                        >
                          <GInputField
                            ref={(node) => {
                              inputRef.current.workPercent =
                                node as FocusTarget | null;
                            }}
                            value={workPercent}
                            onChangeText={setWorkPercent}
                            keyboardType="number-pad"
                            placeholder="0-100"
                            onBlur={() => setFieldTouched("workPercent")}
                            testID="additem-input-workpercent"
                            accessibilityLabel="Work percent"
                            accessibilityState={
                              {
                                invalid: shouldShowFieldError("workPercent"),
                              } as any
                            }
                          />
                        </GInput>
                        <GText size="xs" color="$textLight500">
                          Used to calculate deductible share.
                        </GText>
                        {shouldShowFieldError("workPercent") && (
                          <GText
                            size="xs"
                            color="$error600"
                            accessibilityLiveRegion="polite"
                            testID="additem-error-workpercent"
                          >
                            {validationMessages.workPercent}
                          </GText>
                        )}
                      </GVStack>
                    </GBox>
                  )}
                </GVStack>
              </GCard>

              <GCard
                borderWidth="$1"
                borderColor="$border200"
                style={{
                  backgroundColor: theme.backgroundElement,
                  borderRadius: 16,
                }}
              >
                <GVStack space="md">
                  <Pressable
                    onPress={() => setIsOptionalOpen((current) => !current)}
                    testID="additem-optional-toggle"
                    accessibilityRole="button"
                    accessibilityLabel="Toggle optional fields"
                    accessibilityState={{ expanded: isOptionalOpen }}
                  >
                    <GHStack alignItems="center" justifyContent="space-between">
                      <GHStack alignItems="center" space="sm">
                        {isOptionalOpen ? (
                          <ChevronDown size={16} color={theme.textSecondary} />
                        ) : (
                          <ChevronRight size={16} color={theme.textSecondary} />
                        )}
                        <GHeading size="md">Optional</GHeading>
                      </GHStack>
                      <GText size="xs" color="$textLight500">
                        {isOptionalOpen ? "Hide" : "Show"}
                      </GText>
                    </GHStack>
                  </Pressable>

                  {isOptionalOpen && (
                    <GVStack space="md">
                      <GVStack space="xs">
                        <GText bold size="sm">
                          Notes
                        </GText>
                        <GTextarea>
                          <GTextareaInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Optional context for invoice or audit trail"
                            testID="additem-input-notes"
                            accessibilityLabel="Notes"
                          />
                        </GTextarea>
                        <GText size="xs" color="$textLight500">
                          Optional. Missing notes may be flagged later.
                        </GText>
                      </GVStack>

                      <GBox
                        onLayout={(event) => {
                          fieldYRef.current.warrantyMonths =
                            event.nativeEvent.layout.y;
                        }}
                      >
                        <GVStack space="xs">
                          <GText bold size="sm">
                            Warranty months
                          </GText>
                          <GInput
                            variant="outline"
                            borderColor={
                              shouldShowFieldError("warrantyMonths")
                                ? "$error600"
                                : "$border200"
                            }
                          >
                            <GInputField
                              ref={(node) => {
                                inputRef.current.warrantyMonths =
                                  node as FocusTarget | null;
                              }}
                              value={warrantyMonths}
                              onChangeText={setWarrantyMonths}
                              keyboardType="number-pad"
                              placeholder="Optional"
                              onBlur={() => setFieldTouched("warrantyMonths")}
                              testID="additem-input-warrantymonths"
                              accessibilityLabel="Warranty months"
                              accessibilityState={
                                {
                                  invalid: shouldShowFieldError("warrantyMonths"),
                                } as any
                              }
                            />
                          </GInput>
                          {shouldShowFieldError("warrantyMonths") && (
                            <GText
                              size="xs"
                              color="$error600"
                              accessibilityLiveRegion="polite"
                              testID="additem-error-warrantymonths"
                            >
                              {validationMessages.warrantyMonths}
                            </GText>
                          )}
                          <GText size="xs" color="$textLight500">
                            Warranty until: {warrantyUntilDate ?? "n/a"}
                          </GText>
                        </GVStack>
                      </GBox>

                      <GVStack space="xs">
                        <GText bold size="sm">
                          Vendor
                        </GText>
                        <GInput variant="outline">
                          <GInputField
                            value={vendor}
                            onChangeText={setVendor}
                            placeholder="Optional vendor/store"
                            testID="additem-input-vendor"
                            accessibilityLabel="Vendor"
                          />
                        </GInput>
                      </GVStack>
                    </GVStack>
                  )}
                </GVStack>
              </GCard>

              <GCard
                borderWidth="$1"
                borderColor="$border200"
                style={{
                  backgroundColor: theme.backgroundElement,
                  borderRadius: 16,
                }}
              >
                <GVStack space="md">
                  <Pressable
                    onPress={() => setIsAdvancedOpen((current) => !current)}
                    testID="additem-advanced-toggle"
                    accessibilityRole="button"
                    accessibilityLabel="Toggle advanced fields"
                    accessibilityState={{ expanded: isAdvancedOpen }}
                  >
                    <GHStack alignItems="center" justifyContent="space-between">
                      <GHStack alignItems="center" space="sm">
                        {isAdvancedOpen ? (
                          <ChevronDown size={16} color={theme.textSecondary} />
                        ) : (
                          <ChevronRight size={16} color={theme.textSecondary} />
                        )}
                        <GHeading size="md">Advanced</GHeading>
                      </GHStack>
                      <GText size="xs" color="$textLight500">
                        {isAdvancedOpen ? "Hide" : "Show"}
                      </GText>
                    </GHStack>
                  </Pressable>

                  {isAdvancedOpen && (
                    <GBox
                      onLayout={(event) => {
                        fieldYRef.current.usefulLifeMonthsOverride =
                          event.nativeEvent.layout.y;
                      }}
                    >
                      <GVStack space="xs">
                        <GText bold size="sm">
                          Useful life override (months)
                        </GText>
                        <GInput
                          variant="outline"
                          borderColor={
                            showUsefulLifeError ? "$error600" : "$border200"
                          }
                        >
                          <GInputField
                            ref={(node) => {
                              inputRef.current.usefulLifeMonthsOverride =
                                node as FocusTarget | null;
                            }}
                            value={usefulLifeMonthsOverride}
                            onChangeText={setUsefulLifeMonthsOverride}
                            keyboardType="number-pad"
                            placeholder="Optional, e.g. 36"
                            onBlur={() =>
                              setFieldTouched("usefulLifeMonthsOverride")
                            }
                            testID="additem-input-usefullife"
                            accessibilityLabel="Useful life override in months"
                            accessibilityState={
                              { invalid: showUsefulLifeError } as any
                            }
                          />
                        </GInput>
                        <GText size="xs" color="$textLight500">
                          Overrides automatic useful-life mapping for this item
                          only.
                        </GText>
                        {showUsefulLifeError && (
                          <GText
                            size="xs"
                            color="$error600"
                            accessibilityLiveRegion="polite"
                            testID="additem-error-usefullife"
                          >
                            {usefulLifeMonthsOverrideError}
                          </GText>
                        )}
                      </GVStack>
                    </GBox>
                  )}
                </GVStack>
              </GCard>

              <GVStack space="xs">
                {saveFeedbackMessage && (
                  <GText
                    size="xs"
                    textAlign="center"
                    style={{ color: theme.primary }}
                    accessibilityLiveRegion="polite"
                  >
                    {saveFeedbackMessage}
                  </GText>
                )}
                <GHStack justifyContent="space-between" alignItems="center" space="sm">
                  <GButton
                    flex={1}
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleExitRequest()}
                    disabled={isBusy || isSavingItem}
                    testID="additem-btn-cancel"
                    accessibilityLabel="Cancel add item"
                  >
                    <GButtonText testID="additem-cancel">Cancel</GButtonText>
                  </GButton>

                  <GBox flex={1} testID="additem-btn-submit">
                    <GButton
                      flex={1}
                      onPress={() => void submitAndSave()}
                      disabled={isSaveDisabled}
                      testID="additem-btn-save"
                      accessibilityLabel="Save item"
                    >
                      <GButtonText testID="action-add-item">{isSavingItem ? "Saving..." : "Save Item"}</GButtonText>
                    </GButton>
                  </GBox>
                </GHStack>
              </GVStack>
            </GVStack>
          </ScrollView>

          {Platform.OS === "android" && isDatePickerOpen && (
            <DateTimePicker
              mode="date"
              value={datePickerValue}
              display="default"
              onChange={onAndroidPurchaseDatePickerChange}
            />
          )}

          <GActionsheet
            isOpen={isCategorySheetOpen}
            onClose={() => setIsCategorySheetOpen(false)}
          >
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
                <GActionsheetItemText>
                  No category selected
                </GActionsheetItemText>
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
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(previewAttachment)}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewAttachment(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
          onPress={() => setPreviewAttachment(null)}
        >
          {previewAttachment && !isPdfAttachment(previewAttachment) && (
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 760,
                maxHeight: "80%",
                backgroundColor: theme.background,
                borderRadius: 16,
                padding: 12,
              }}
            >
              <Image
                source={{ uri: previewAttachment.filePath }}
                resizeMode="contain"
                style={{ width: "100%", height: 380, borderRadius: 10 }}
              />
              <GHStack
                justifyContent="space-between"
                alignItems="center"
                mt="$3"
              >
                <GButton
                  size="sm"
                  variant="outline"
                  action="secondary"
                  onPress={() => setPreviewAttachment(null)}
                  accessibilityLabel="Close attachment preview"
                >
                  <GButtonText>Close</GButtonText>
                </GButton>
                <GButton
                  size="sm"
                  variant="outline"
                  action="secondary"
                  onPress={() =>
                    void removeAttachment(previewAttachment.filePath)
                  }
                  accessibilityLabel="Delete attachment"
                >
                  <GButtonText>Delete</GButtonText>
                </GButton>
              </GHStack>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <Modal
        visible={isDiscardModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDiscardModal}
      >
        <GBox
          flex={1}
          alignItems="center"
          justifyContent="center"
          px="$5"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          testID="discard-modal"
        >
          <GCard
            borderWidth="$1"
            borderColor="$border200"
            width="$full"
            maxWidth={420}
            style={{ backgroundColor: theme.background, borderRadius: 16 }}
          >
            <GVStack space="md">
              <GVStack space="xs">
                <GHeading size="md">Discard changes?</GHeading>
                <GText size="sm">
                  Your changes and draft attachments will be lost.
                </GText>
              </GVStack>
              <GHStack justifyContent="flex-end" space="sm">
                <GButton
                  size="sm"
                  variant="outline"
                  action="secondary"
                  onPress={closeDiscardModal}
                  testID="keep-editing"
                  accessibilityLabel="Keep editing"
                >
                  <GButtonText testID="additem-discard-keepediting">
                    Keep editing
                  </GButtonText>
                </GButton>
                <GButton
                  size="sm"
                  action="negative"
                  onPress={() => void exitAfterDiscard()}
                  testID="discard-confirm"
                  accessibilityLabel="Discard changes"
                >
                  <GButtonText testID="additem-discard-confirm">
                    Discard
                  </GButtonText>
                </GButton>
              </GHStack>
            </GVStack>
          </GCard>
        </GBox>
      </Modal>
    </SafeAreaView>
  );
}
