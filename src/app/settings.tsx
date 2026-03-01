import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import {
  AlertDialog as GAlertDialog,
  AlertDialogBackdrop as GAlertDialogBackdrop,
  AlertDialogBody as GAlertDialogBody,
  AlertDialogContent as GAlertDialogContent,
  AlertDialogFooter as GAlertDialogFooter,
  AlertDialogHeader as GAlertDialogHeader,
  Box as GBox,
  Button as GButton,
  ButtonText as GButtonText,
  Card as GCard,
  Heading as GHeading,
  HStack as GHStack,
  Input as GInput,
  InputField as GInputField,
  Spinner as GSpinner,
  Switch as GSwitch,
  Text as GText,
  VStack as GVStack,
} from "@gluestack-ui/themed";

import { useThemeMode } from "@/contexts/theme-mode-context";
import { estimateTaxImpact } from "@/domain/calculation-engine";
import { createDefaultProfileSettings, type ProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import {
  emitDatabaseRestored,
  emitLocalDataDeleted,
  emitProfileSettingsSaved,
} from "@/services/app-events";
import { getOneDriveAuthProvider } from "@/services/auth/onedrive-auth-provider";
import {
  createLocalBackupZip,
  restoreFromBackupZip,
  shareBackupZip,
  type BackupExportResult,
  type RestoreResultSummary,
} from "@/services/backup-restore";
import {
  runExportPipeline,
  type ExportPipelineResult,
  type ExportProgress,
} from "@/services/export-pipeline";
import { friendlyFileErrorMessage } from "@/services/friendly-errors";
import { deleteAllLocalData } from "@/services/local-data";
import {
  ensureSelectedFolderAccessible,
  getOneDriveRedirectUri,
  getSelectedOneDriveFolder,
  listOneDriveFolders,
  setSelectedOneDriveFolder,
  type OneDriveFolder,
  type OneDriveFolderSelection,
} from "@/services/onedrive-auth";
import { hasPinAsync, isValidPin, setPinAsync, verifyPinAsync } from "@/services/pin-auth";
import type { ThemeMode } from "@/theme/theme-mode";
import { formatCents } from "@/utils/money";

WebBrowser.maybeCompleteAuthSession();
const oneDriveAuthProvider = getOneDriveAuthProvider();

interface TaxDefaultsFormState {
  taxYearDefault: string;
  marginalRatePercent: string;
  defaultWorkPercent: string;
  gwgThresholdEuros: string;
  applyHalfYearRule: boolean;
  appLockEnabled: boolean;
  uploadToOneDriveAfterExport: boolean;
}

interface TaxDefaultsValues {
  taxYearDefault: number;
  marginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: boolean;
  appLockEnabled: boolean;
  uploadToOneDriveAfterExport: boolean;
}

function createFormState(settings: ProfileSettings): TaxDefaultsFormState {
  return {
    taxYearDefault: String(settings.taxYearDefault),
    marginalRatePercent: String(settings.marginalRateBps / 100),
    defaultWorkPercent: String(settings.defaultWorkPercent),
    gwgThresholdEuros: (settings.gwgThresholdCents / 100).toFixed(2),
    applyHalfYearRule: settings.applyHalfYearRule,
    appLockEnabled: settings.appLockEnabled,
    uploadToOneDriveAfterExport: settings.uploadToOneDriveAfterExport,
  };
}

function parseNumber(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function calculatePreview(values: TaxDefaultsValues) {
  const sampleItemCents = 150_000;
  const estimate = estimateTaxImpact(
    {
      totalCents: sampleItemCents,
      usageType: "MIXED",
      workPercent: values.defaultWorkPercent,
      purchaseDate: `${values.taxYearDefault}-07-15`,
      usefulLifeMonths: 36,
    },
    {
      gwgThresholdCents: values.gwgThresholdCents,
      applyHalfYearRule: values.applyHalfYearRule,
      marginalRateBps: values.marginalRateBps,
      defaultWorkPercent: values.defaultWorkPercent,
    },
    values.taxYearDefault
  );
  const workRelevantCents = Math.round((sampleItemCents * values.defaultWorkPercent) / 100);

  return {
    sampleItemCents,
    workRelevantCents,
    deductibleThisYearCents: estimate.deductibleThisYearCents,
    estimatedRefundCents: estimate.estimatedRefundThisYearCents,
    immediate: estimate.scheduleByYear.length === 1,
  };
}

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

type ConfirmAction = "deleteLocalData" | "importBackup";

export default function SettingsScreen() {
  const { mode, resolvedMode, setMode } = useThemeMode();

  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [formState, setFormState] = useState<TaxDefaultsFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [pinExists, setPinExists] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  const [backupResult, setBackupResult] = useState<BackupExportResult | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<RestoreResultSummary | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [oneDriveBusy, setOneDriveBusy] = useState(false);
  const [oneDriveError, setOneDriveError] = useState<string | null>(null);
  const [oneDriveFolders, setOneDriveFolders] = useState<OneDriveFolder[]>([]);
  const [oneDriveSelectedFolder, setOneDriveSelectedFolderState] =
    useState<OneDriveFolderSelection | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportPipelineResult | null>(null);

  const [dangerError, setDangerError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);

  const reloadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getProfileSettingsRepository();
      const loaded = await repository.getSettings();
      const [hasPin, connected, selectedFolder] = await Promise.all([
        hasPinAsync(),
        oneDriveAuthProvider.isConnected(),
        getSelectedOneDriveFolder(),
      ]);

      setSettings(loaded);
      setFormState(createFormState(loaded));
      setPinExists(hasPin);
      setOneDriveConnected(connected);
      setOneDriveSelectedFolderState(selectedFolder);
    } catch (error) {
      console.error("Failed to load settings", error);
      const fallback = createDefaultProfileSettings();
      setSettings(fallback);
      setFormState(createFormState(fallback));
      setLoadError("Could not load settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  const validation = useMemo(() => {
    if (!formState) {
      return { valid: false, fieldErrors: { formState: "Settings are still loading." } } as const;
    }

    const parsedTaxYear = parseNumber(formState.taxYearDefault);
    const parsedRate = parseNumber(formState.marginalRatePercent);
    const parsedWorkPercent = parseNumber(formState.defaultWorkPercent);
    const parsedGwgThresholdEuros = parseNumber(formState.gwgThresholdEuros);
    const fieldErrors: Record<string, string> = {};

    if (parsedTaxYear === null || !Number.isInteger(parsedTaxYear)) {
      fieldErrors.taxYearDefault = "Tax year must be a whole number.";
    } else if (parsedTaxYear < 2000 || parsedTaxYear > 2100) {
      fieldErrors.taxYearDefault = "Tax year must be between 2000 and 2100.";
    }

    if (parsedRate === null) {
      fieldErrors.marginalRatePercent = "Marginal tax rate is required.";
    } else if (parsedRate < 0 || parsedRate > 55) {
      fieldErrors.marginalRatePercent = "Marginal tax rate must be between 0 and 55%.";
    }

    if (parsedWorkPercent === null) {
      fieldErrors.defaultWorkPercent = "Default work percent is required.";
    } else if (parsedWorkPercent < 0 || parsedWorkPercent > 100) {
      fieldErrors.defaultWorkPercent = "Default work percent must be between 0 and 100.";
    }

    if (parsedGwgThresholdEuros === null) {
      fieldErrors.gwgThresholdEuros = "GWG threshold is required.";
    } else if (parsedGwgThresholdEuros < 0) {
      fieldErrors.gwgThresholdEuros = "GWG threshold must be 0 or higher.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { valid: false, fieldErrors } as const;
    }

    return {
      valid: true,
      fieldErrors,
      values: {
        taxYearDefault: Math.round(parsedTaxYear!),
        marginalRateBps: Math.round(parsedRate! * 100),
        defaultWorkPercent: Math.round(parsedWorkPercent!),
        gwgThresholdCents: Math.round(parsedGwgThresholdEuros! * 100),
        applyHalfYearRule: formState.applyHalfYearRule,
        appLockEnabled: formState.appLockEnabled,
        uploadToOneDriveAfterExport: formState.uploadToOneDriveAfterExport,
      },
    } as const;
  }, [formState]);

  const preview = useMemo(() => {
    if (!validation.valid) {
      return null;
    }
    return calculatePreview(validation.values);
  }, [validation]);

  const updateFormField = <K extends keyof TaxDefaultsFormState>(
    key: K,
    value: TaxDefaultsFormState[K]
  ) => {
    setFormState((current) => (current ? { ...current, [key]: value } : current));
    setSaveError(null);
    setSaveSuccess(null);
  };
  const handleSaveSettings = async () => {
    if (!validation.valid || isSavingSettings) {
      return;
    }

    setIsSavingSettings(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const repository = await getProfileSettingsRepository();
      const updated = await repository.upsertSettings(validation.values);
      setSettings(updated);
      setFormState(createFormState(updated));
      setSaveSuccess("Settings saved.");
      emitProfileSettingsSaved();
    } catch (error) {
      console.error("Failed to save settings", error);
      setSaveError("Could not save settings. Please retry.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetDefaults = async () => {
    if (isSavingSettings) {
      return;
    }

    setIsSavingSettings(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const repository = await getProfileSettingsRepository();
      const defaults = {
        ...createDefaultProfileSettings(),
        themeModePreference: mode,
      };
      const updated = await repository.upsertSettings(defaults);
      setSettings(updated);
      setFormState(createFormState(updated));
      setSaveSuccess("Defaults restored.");
      emitProfileSettingsSaved();
    } catch (error) {
      console.error("Failed to reset settings", error);
      setSaveError("Could not reset settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSavePin = async () => {
    setPinError(null);
    setPinSuccess(null);

    if (!isValidPin(newPin)) {
      setPinError("PIN must be 4 to 6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("PIN confirmation does not match.");
      return;
    }

    if (pinExists) {
      const check = await verifyPinAsync(currentPin);
      if (!check.success) {
        setPinError("Current PIN is incorrect.");
        return;
      }
    }

    await setPinAsync(newPin);
    setPinExists(true);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinSuccess("PIN saved successfully.");
  };

  const handleCreateBackup = async () => {
    setBackupError(null);
    setRestoreSummary(null);
    setBackupBusy(true);
    try {
      const result = await createLocalBackupZip();
      setBackupResult(result);
    } catch (error) {
      console.error("Failed to create backup ZIP", error);
      setBackupError(friendlyFileErrorMessage(error, "Could not create backup ZIP."));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleShareBackup = async () => {
    if (!backupResult) {
      return;
    }
    setBackupError(null);
    setRestoreSummary(null);
    setBackupBusy(true);
    try {
      await shareBackupZip(backupResult.fileUri);
    } catch (error) {
      console.error("Failed to share backup ZIP", error);
      setBackupError(friendlyFileErrorMessage(error, "Could not share backup ZIP."));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleConnectOneDrive = async () => {
    setOneDriveError(null);
    setOneDriveBusy(true);
    try {
      await oneDriveAuthProvider.connect();
      setOneDriveConnected(true);
      const selected = await getSelectedOneDriveFolder();
      setOneDriveSelectedFolderState(selected);
    } catch (error) {
      console.error("Failed to connect OneDrive", error);
      setOneDriveError(error instanceof Error ? error.message : "Could not connect OneDrive.");
    } finally {
      setOneDriveBusy(false);
    }
  };

  const handleDisconnectOneDrive = async () => {
    setOneDriveError(null);
    setOneDriveBusy(true);
    try {
      await oneDriveAuthProvider.disconnect();
      setOneDriveConnected(false);
      setOneDriveSelectedFolderState(null);
      setOneDriveFolders([]);
    } catch (error) {
      console.error("Failed to disconnect OneDrive", error);
      setOneDriveError("Could not disconnect OneDrive.");
    } finally {
      setOneDriveBusy(false);
    }
  };

  const handleLoadOneDriveFolders = async () => {
    setOneDriveBusy(true);
    setOneDriveError(null);
    try {
      const folders = await listOneDriveFolders();
      setOneDriveFolders(folders);
      if (folders.length === 0) {
        setOneDriveError("No folders found in OneDrive root. Create one and retry.");
      }
    } catch (error) {
      console.error("Failed to load OneDrive folders", error);
      setOneDriveError("Could not load OneDrive folders. Reconnect and try again.");
    } finally {
      setOneDriveBusy(false);
    }
  };

  const handleSelectOneDriveFolder = async (folder: OneDriveFolder) => {
    setOneDriveBusy(true);
    setOneDriveError(null);
    try {
      await setSelectedOneDriveFolder({ id: folder.id, path: folder.path });
      setOneDriveSelectedFolderState({ id: folder.id, path: folder.path });
    } catch (error) {
      console.error("Failed to persist selected OneDrive folder", error);
      setOneDriveError("Could not save selected OneDrive folder.");
    } finally {
      setOneDriveBusy(false);
    }
  };

  const handleVerifySelectedFolder = async () => {
    setOneDriveBusy(true);
    setOneDriveError(null);
    try {
      await ensureSelectedFolderAccessible();
    } catch (error) {
      console.error("Selected OneDrive folder is not accessible", error);
      setOneDriveError(
        error instanceof Error
          ? error.message
          : "Selected folder is not accessible. Re-select a folder."
      );
    } finally {
      setOneDriveBusy(false);
    }
  };

  const handleRunTestExport = async () => {
    if (!settings) {
      return;
    }
    setExportProgress({
      stage: "local",
      progressPercent: 0,
      message: "Preparing local export...",
    });
    setExportResult(null);
    try {
      const result = await runExportPipeline({
        fileName: `steuerfuchs-test-export-${Date.now()}.txt`,
        content:
          "This is a local export test generated by SteuerFuchs.\nIt proves local export remains available without cloud.",
        uploadToOneDrive: settings.uploadToOneDriveAfterExport && oneDriveConnected,
        onProgress: setExportProgress,
      });
      setExportResult(result);
      if (result.uploadStatus === "uploaded") {
        setOneDriveError(null);
      } else if (result.uploadStatus === "failed") {
        setOneDriveError(
          result.uploadError ??
            "OneDrive upload failed, but your local export was created successfully."
        );
      }
    } catch (error) {
      console.error("Failed to run test export", error);
      setOneDriveError("Test export failed unexpectedly.");
      setExportProgress(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    setIsConfirmBusy(true);
    if (confirmAction === "deleteLocalData") {
      setDangerError(null);
      try {
        await deleteAllLocalData();
        emitLocalDataDeleted();
        setMode("system");
        const defaults = createDefaultProfileSettings();
        setSettings(defaults);
        setFormState(createFormState(defaults));
      } catch (error) {
        console.error("Failed to delete local data", error);
        setDangerError("Could not delete local data. Please retry.");
      } finally {
        setConfirmAction(null);
        setIsConfirmBusy(false);
      }
      return;
    }

    if (confirmAction === "importBackup") {
      setBackupError(null);
      setRestoreSummary(null);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/zip", "application/x-zip-compressed"],
          multiple: false,
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets.length > 0) {
          const summary = await restoreFromBackupZip(result.assets[0].uri);
          setRestoreSummary(summary);
          emitDatabaseRestored();
          await reloadSettings();
        }
      } catch (error) {
        console.error("Failed to import backup ZIP", error);
        setBackupError(friendlyFileErrorMessage(error, "Could not import backup ZIP."));
      } finally {
        setConfirmAction(null);
        setIsConfirmBusy(false);
      }
    }
  };

  if (isLoading || !formState) {
    return (
      <GBox flex={1} px="$5" py="$6" alignItems="center" justifyContent="center">
        <GVStack space="md" alignItems="center">
          <GSpinner size="large" />
          <GText size="sm">Loading settings...</GText>
        </GVStack>
      </GBox>
    );
  }

  return (
    <GBox flex={1} px="$5" py="$6">
      <ScrollView
        contentContainerStyle={{
          width: "100%",
          maxWidth: 860,
          alignSelf: "center",
          paddingBottom: 24,
        }}
      >
        <GVStack space="lg">
          <GVStack space="xs">
            <GHeading size="2xl">Settings</GHeading>
            <GText size="sm">Configure theme, tax defaults, and local device controls.</GText>
          </GVStack>

          {loadError && (
            <GCard borderWidth="$1" borderColor="$error300">
              <GText size="sm">{loadError}</GText>
            </GCard>
          )}

          <GCard borderWidth="$1" borderColor="$border200">
            <GVStack space="md">
              <GHeading size="md">Theme</GHeading>
              <GText size="sm">Choose how the app appearance is resolved.</GText>
              <GHStack space="sm" flexWrap="wrap">
                {themeOptions.map((option) => (
                  <GButton
                    key={option.value}
                    size="sm"
                    variant={mode === option.value ? "solid" : "outline"}
                    action={mode === option.value ? "primary" : "secondary"}
                    onPress={() => setMode(option.value)}
                    testID={`settings-theme-${option.value}`}
                  >
                    <GButtonText>{option.label}</GButtonText>
                  </GButton>
                ))}
              </GHStack>
              <GText size="xs">Resolved mode now: {resolvedMode}</GText>
            </GVStack>
          </GCard>

          <GCard borderWidth="$1" borderColor="$border200">
            <GVStack space="md">
              <GHeading size="md">Tax defaults</GHeading>

              <GVStack space="xs">
                <GText bold size="sm">Tax year default</GText>
                <GInput variant="outline">
                  <GInputField
                    value={formState.taxYearDefault}
                    onChangeText={(value) => updateFormField("taxYearDefault", value)}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="2026"
                    testID="settings-tax-year-input"
                  />
                </GInput>
                {validation.fieldErrors.taxYearDefault && (
                  <GText size="xs" color="$error600">{validation.fieldErrors.taxYearDefault}</GText>
                )}
              </GVStack>

              <GVStack space="xs">
                <GText bold size="sm">Marginal tax rate (%)</GText>
                <GInput variant="outline">
                  <GInputField
                    value={formState.marginalRatePercent}
                    onChangeText={(value) => updateFormField("marginalRatePercent", value)}
                    keyboardType="decimal-pad"
                    placeholder="40"
                    testID="settings-marginal-rate-input"
                  />
                </GInput>
                {validation.fieldErrors.marginalRatePercent && (
                  <GText size="xs" color="$error600">{validation.fieldErrors.marginalRatePercent}</GText>
                )}
              </GVStack>

              <GVStack space="xs">
                <GText bold size="sm">Default work percent (%)</GText>
                <GInput variant="outline">
                  <GInputField
                    value={formState.defaultWorkPercent}
                    onChangeText={(value) => updateFormField("defaultWorkPercent", value)}
                    keyboardType="number-pad"
                    placeholder="100"
                    testID="settings-default-work-percent-input"
                  />
                </GInput>
                {validation.fieldErrors.defaultWorkPercent && (
                  <GText size="xs" color="$error600">{validation.fieldErrors.defaultWorkPercent}</GText>
                )}
              </GVStack>

              <GVStack space="xs">
                <GText bold size="sm">GWG threshold (EUR)</GText>
                <GInput variant="outline">
                  <GInputField
                    value={formState.gwgThresholdEuros}
                    onChangeText={(value) => updateFormField("gwgThresholdEuros", value)}
                    keyboardType="decimal-pad"
                    placeholder="1000.00"
                    testID="settings-gwg-threshold-input"
                  />
                </GInput>
                {validation.fieldErrors.gwgThresholdEuros && (
                  <GText size="xs" color="$error600">{validation.fieldErrors.gwgThresholdEuros}</GText>
                )}
              </GVStack>

              <GHStack justifyContent="space-between" alignItems="center">
                <GText size="sm">Apply half-year rule</GText>
                <GSwitch
                  value={formState.applyHalfYearRule}
                  onValueChange={(value) => updateFormField("applyHalfYearRule", value)}
                />
              </GHStack>

              <GHStack justifyContent="space-between" alignItems="center">
                <GText size="sm">App lock enabled</GText>
                <GSwitch
                  value={formState.appLockEnabled}
                  onValueChange={(value) => updateFormField("appLockEnabled", value)}
                />
              </GHStack>

              <GHStack justifyContent="space-between" alignItems="center">
                <GText size="sm">Upload to OneDrive after export</GText>
                <GSwitch
                  value={formState.uploadToOneDriveAfterExport}
                  onValueChange={(value) =>
                    updateFormField("uploadToOneDriveAfterExport", value)
                  }
                />
              </GHStack>

              {saveError && <GText size="sm" color="$error600">{saveError}</GText>}
              {saveSuccess && <GText size="sm" color="$success600">{saveSuccess}</GText>}

              <GHStack space="sm" flexWrap="wrap">
                <GButton
                  onPress={() => void handleSaveSettings()}
                  disabled={!validation.valid || isSavingSettings}
                  testID="settings-save"
                >
                  <GButtonText>{isSavingSettings ? "Saving..." : "Save settings"}</GButtonText>
                </GButton>
                <GButton
                  variant="outline"
                  action="secondary"
                  onPress={() => void handleResetDefaults()}
                  disabled={isSavingSettings}
                >
                  <GButtonText>Reset to defaults</GButtonText>
                </GButton>
              </GHStack>
            </GVStack>
          </GCard>

          {preview && (
            <GCard borderWidth="$1" borderColor="$border200">
              <GVStack space="xs">
                <GHeading size="sm">Calculation preview (sample item)</GHeading>
                <GText size="sm">Sample item: {formatCents(preview.sampleItemCents)}</GText>
                <GText size="sm">Work-relevant: {formatCents(preview.workRelevantCents)}</GText>
                <GText size="sm">
                  Deductible this year: {formatCents(preview.deductibleThisYearCents)}
                </GText>
                <GText size="sm">Estimated refund: {formatCents(preview.estimatedRefundCents)}</GText>
                <GText size="sm">Mode: {preview.immediate ? "Immediate deduction" : "AfA schedule"}</GText>
              </GVStack>
            </GCard>
          )}

          <GCard borderWidth="$1" borderColor="$border200">
            <GVStack space="md">
              <GHeading size="md">PIN fallback</GHeading>
              <GText size="sm">
                {pinExists ? "PIN is configured. You can change it below." : "Set a PIN fallback for app lock."}
              </GText>
              {pinExists && (
                <GInput variant="outline">
                  <GInputField
                    value={currentPin}
                    onChangeText={setCurrentPin}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="Current PIN"
                  />
                </GInput>
              )}
              <GInput variant="outline">
                <GInputField
                  value={newPin}
                  onChangeText={setNewPin}
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder={pinExists ? "New PIN (4-6 digits)" : "PIN (4-6 digits)"}
                />
              </GInput>
              <GInput variant="outline">
                <GInputField
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="Confirm PIN"
                />
              </GInput>
              {pinError && <GText size="sm" color="$error600">{pinError}</GText>}
              {pinSuccess && <GText size="sm" color="$success600">{pinSuccess}</GText>}
              <GButton variant="outline" action="secondary" onPress={() => void handleSavePin()}>
                <GButtonText>{pinExists ? "Change PIN" : "Set PIN"}</GButtonText>
              </GButton>
            </GVStack>
          </GCard>

          <GCard borderWidth="$1" borderColor="$border200">
            <GVStack space="md">
              <GHeading size="md">Local backup / restore</GHeading>
              <GText size="sm">Create and restore local backup ZIP snapshots.</GText>
              {backupError && <GText size="sm" color="$error600">{backupError}</GText>}
              <GHStack space="sm" flexWrap="wrap">
                <GButton onPress={() => void handleCreateBackup()} disabled={backupBusy}>
                  <GButtonText>{backupBusy ? "Working..." : "Create backup ZIP"}</GButtonText>
                </GButton>
                <GButton
                  variant="outline"
                  action="secondary"
                  onPress={() => void handleShareBackup()}
                  disabled={backupBusy || !backupResult}
                >
                  <GButtonText>Share latest backup</GButtonText>
                </GButton>
                <GButton
                  variant="outline"
                  action="negative"
                  onPress={() => setConfirmAction("importBackup")}
                  disabled={backupBusy}
                >
                  <GButtonText>Import backup (overwrite)</GButtonText>
                </GButton>
              </GHStack>
              {backupResult && (
                <GText size="sm">
                  Latest backup: {backupResult.fileName} | Size: {(backupResult.sizeBytes / 1024 / 1024).toFixed(2)} MB | Attachments: {backupResult.manifest.attachmentCount} | Missing: {backupResult.manifest.missingAttachmentCount}
                </GText>
              )}
              {restoreSummary && (
                <GText size="sm" color={restoreSummary.missingFilesCount > 0 ? "$warning600" : "$success600"}>
                  Restored items: {restoreSummary.itemCountRestored} | Attachments: {restoreSummary.attachmentCountRestored} | Missing files: {restoreSummary.missingFilesCount}
                </GText>
              )}
            </GVStack>
          </GCard>

          <GCard borderWidth="$1" borderColor="$border200">
            <GVStack space="md">
              <GHeading size="md">OneDrive (export-only)</GHeading>
              <GText size="sm">Connect OneDrive for user-triggered export uploads. App works fully without it.</GText>
              <GText size="sm">Redirect URI: {getOneDriveRedirectUri()}</GText>
              <GText size="sm">Status: {oneDriveConnected ? "Connected" : "Not connected"}</GText>
              <GText size="sm">Selected folder: {oneDriveSelectedFolder ? oneDriveSelectedFolder.path : "Not selected"}</GText>
              {oneDriveError && <GText size="sm" color="$error600">{oneDriveError}</GText>}

              {!oneDriveConnected ? (
                <GButton onPress={() => void handleConnectOneDrive()} disabled={oneDriveBusy}>
                  <GButtonText>{oneDriveBusy ? "Connecting..." : "Connect OneDrive"}</GButtonText>
                </GButton>
              ) : (
                <GButton
                  variant="outline"
                  action="secondary"
                  onPress={() => void handleDisconnectOneDrive()}
                  disabled={oneDriveBusy}
                >
                  <GButtonText>{oneDriveBusy ? "Disconnecting..." : "Disconnect OneDrive"}</GButtonText>
                </GButton>
              )}

              {oneDriveConnected && (
                <>
                  <GButton
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleLoadOneDriveFolders()}
                    disabled={oneDriveBusy}
                  >
                    <GButtonText>{oneDriveBusy ? "Loading..." : "Load OneDrive folders"}</GButtonText>
                  </GButton>
                  {oneDriveFolders.map((folder) => (
                    <GButton
                      key={folder.id}
                      variant="outline"
                      action="secondary"
                      onPress={() => void handleSelectOneDriveFolder(folder)}
                      disabled={oneDriveBusy}
                    >
                      <GButtonText>{folder.path}</GButtonText>
                    </GButton>
                  ))}
                  <GButton
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleVerifySelectedFolder()}
                    disabled={oneDriveBusy || !oneDriveSelectedFolder}
                  >
                    <GButtonText>Verify selected folder access</GButtonText>
                  </GButton>
                </>
              )}

              <GButton
                variant="outline"
                action="secondary"
                onPress={() => void handleRunTestExport()}
                disabled={oneDriveBusy}
              >
                <GButtonText>Run test export pipeline</GButtonText>
              </GButton>

              {exportProgress && (
                <GText size="sm">
                  {exportProgress.stage.toUpperCase()}: {exportProgress.progressPercent}% - {exportProgress.message}
                </GText>
              )}
              {exportResult && (
                <GText size="sm">
                  Local file: {exportResult.localFileName}
                  {exportResult.uploadStatus === "uploaded"
                    ? ` | Uploaded: ${exportResult.uploadedFileName ?? exportResult.localFileName}`
                    : exportResult.uploadStatus === "failed"
                      ? " | Upload failed (local export still saved)"
                      : " | Upload skipped"}
                </GText>
              )}
            </GVStack>
          </GCard>

          <GCard borderWidth="$1" borderColor="$error300">
            <GVStack space="md">
              <GHeading size="md">Danger zone</GHeading>
              <GText size="sm">Delete all local data (items, attachments, settings, and PIN) from this device.</GText>
              {dangerError && <GText size="sm" color="$error600">{dangerError}</GText>}
              <GButton
                action="negative"
                variant="outline"
                onPress={() => setConfirmAction("deleteLocalData")}
                testID="settings-delete-local-data"
              >
                <GButtonText>Delete all local data</GButtonText>
              </GButton>
            </GVStack>
          </GCard>
        </GVStack>
      </ScrollView>

      <GAlertDialog isOpen={confirmAction !== null} onClose={() => setConfirmAction(null)}>
        <GAlertDialogBackdrop />
        <GAlertDialogContent>
          <GAlertDialogHeader>
            <GHeading size="md">
              {confirmAction === "deleteLocalData"
                ? "Delete all local data?"
                : "Import backup snapshot?"}
            </GHeading>
          </GAlertDialogHeader>
          <GAlertDialogBody>
            <GText size="sm">
              {confirmAction === "deleteLocalData"
                ? "This action is irreversible and removes all local app data from this device."
                : "Importing backup will overwrite your current local data, including DB and attachment files. This action cannot be undone."}
            </GText>
          </GAlertDialogBody>
          <GAlertDialogFooter>
            <GHStack space="sm">
              <GButton
                variant="outline"
                action="secondary"
                onPress={() => setConfirmAction(null)}
                disabled={isConfirmBusy}
                testID="settings-confirm-cancel"
              >
                <GButtonText>Cancel</GButtonText>
              </GButton>
              <GButton
                action="negative"
                onPress={() => void handleConfirmAction()}
                disabled={isConfirmBusy}
                testID="settings-confirm-accept"
              >
                <GButtonText>{isConfirmBusy ? "Working..." : "Confirm"}</GButtonText>
              </GButton>
            </GHStack>
          </GAlertDialogFooter>
        </GAlertDialogContent>
      </GAlertDialog>
    </GBox>
  );
}
