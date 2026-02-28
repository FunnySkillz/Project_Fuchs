import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { ProfileSettingsForm, type ProfileSettingsFormValues } from "@/components/profile-settings-form";
import { ThemedText } from "@/components/themed-text";
import { createDefaultProfileSettings, type ProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { Spacing } from "@/constants/theme";
import { emitLocalDataDeleted } from "@/services/app-events";
import { getOneDriveAuthProvider } from "@/services/auth/onedrive-auth-provider";
import { deleteAllLocalData } from "@/services/local-data";
import {
  ensureSelectedFolderAccessible,
  getOneDriveRedirectUri,
  getSelectedOneDriveFolder,
  listOneDriveFolders,
  type OneDriveFolder,
  type OneDriveFolderSelection,
  setSelectedOneDriveFolder,
} from "@/services/onedrive-auth";
import {
  runExportPipeline,
  type ExportPipelineResult,
  type ExportProgress,
} from "@/services/export-pipeline";
import {
  hasPinAsync,
  isValidPin,
  setPinAsync,
  verifyPinAsync,
} from "@/services/pin-auth";
import { estimateTaxImpact } from "@/domain/calculation-engine";
import { formatCents } from "@/utils/money";

WebBrowser.maybeCompleteAuthSession();
const oneDriveAuthProvider = getOneDriveAuthProvider();

function calculatePreview(values: ProfileSettingsFormValues) {
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
  const workRelevantCents = Math.round(
    (sampleItemCents * values.defaultWorkPercent) / 100
  );

  return {
    sampleItemCents,
    workRelevantCents,
    deductibleThisYearCents: estimate.deductibleThisYearCents,
    estimatedRefundCents: estimate.estimatedRefundThisYearCents,
    immediate: estimate.scheduleByYear.length === 1,
  };
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<ProfileSettingsFormValues | null>(null);
  const [pinExists, setPinExists] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [oneDriveBusy, setOneDriveBusy] = useState(false);
  const [oneDriveError, setOneDriveError] = useState<string | null>(null);
  const [oneDriveFolders, setOneDriveFolders] = useState<OneDriveFolder[]>([]);
  const [oneDriveSelectedFolder, setOneDriveSelectedFolderState] = useState<OneDriveFolderSelection | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportPipelineResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const repository = await getProfileSettingsRepository();
        const loaded = await repository.getSettings();
        if (isMounted) {
          setSettings(loaded);
          const hasPin = await hasPinAsync();
          setPinExists(hasPin);
          const connected = await oneDriveAuthProvider.isConnected();
          setOneDriveConnected(connected);
          const selected = await getSelectedOneDriveFolder();
          setOneDriveSelectedFolderState(selected);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load settings", error);
          setLoadError("Could not load settings.");
          setSettings(createDefaultProfileSettings());
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (values: ProfileSettingsFormValues) => {
    const repository = await getProfileSettingsRepository();
    const updated = await repository.upsertSettings(values);
    setSettings(updated);
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

  const confirmDeleteAllData = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      return globalThis.confirm(
        "Delete all local data? This will permanently remove your items, settings, attachments, and app lock PIN from this device."
      );
    }

    return new Promise((resolve) => {
      Alert.alert(
        "Delete all local data",
        "This permanently removes all local app data from this device. This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Delete", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });
  };

  const handleDeleteAllLocalData = async () => {
    setDangerError(null);
    const confirmed = await confirmDeleteAllData();
    if (!confirmed) {
      return;
    }

    try {
      await deleteAllLocalData();
      emitLocalDataDeleted();
    } catch (error) {
      console.error("Failed to delete local data", error);
      setDangerError("Could not delete local data. Please try again.");
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
      setOneDriveError(
        error instanceof Error ? error.message : "Could not connect OneDrive."
      );
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
      await setSelectedOneDriveFolder({
        id: folder.id,
        path: folder.path,
      });
      setOneDriveSelectedFolderState({
        id: folder.id,
        path: folder.path,
      });
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

  const handleReset = async () => {
    const repository = await getProfileSettingsRepository();
    const defaults = createDefaultProfileSettings();
    const updated = await repository.upsertSettings(defaults);
    setSettings(updated);
    setDraftValues({
      taxYearDefault: updated.taxYearDefault,
      marginalRateBps: updated.marginalRateBps,
      defaultWorkPercent: updated.defaultWorkPercent,
      gwgThresholdCents: updated.gwgThresholdCents,
      applyHalfYearRule: updated.applyHalfYearRule,
      appLockEnabled: updated.appLockEnabled,
      uploadToOneDriveAfterExport: updated.uploadToOneDriveAfterExport,
    });
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

  if (!settings) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText>Loading settings...</ThemedText>
      </View>
    );
  }

  const preview = draftValues ? calculatePreview(draftValues) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="title">Settings</ThemedText>
      <ThemedText themeColor="textSecondary">
        Update your local profile defaults. These values affect future calculations.
      </ThemedText>
      {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}
      <ProfileSettingsForm
        initialValues={settings}
        submitLabel="Save Settings"
        showAdvanced
        onSubmit={handleSubmit}
        onResetToDefault={handleReset}
        onValuesChange={setDraftValues}
      />
      {preview && (
        <View style={styles.previewCard}>
          <ThemedText type="smallBold">Calculation Preview (sample item)</ThemedText>
          <ThemedText type="small">Sample item price: {formatCents(preview.sampleItemCents)}</ThemedText>
          <ThemedText type="small">
            Work-relevant amount: {formatCents(preview.workRelevantCents)}
          </ThemedText>
          <ThemedText type="small">
            Deductible this year: {formatCents(preview.deductibleThisYearCents)}
          </ThemedText>
          <ThemedText type="small">
            Estimated refund: {formatCents(preview.estimatedRefundCents)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Mode: {preview.immediate ? "Immediate deduction (below GWG)" : "AfA schedule (above GWG)"}
          </ThemedText>
        </View>
      )}
      <View style={styles.pinCard}>
        <ThemedText type="smallBold">PIN Fallback</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {pinExists ? "PIN is configured. You can change it below." : "Set a PIN fallback for app lock."}
        </ThemedText>
        {pinExists && (
          <TextInput
            value={currentPin}
            onChangeText={setCurrentPin}
            style={styles.pinInput}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            placeholder="Current PIN"
          />
        )}
        <TextInput
          value={newPin}
          onChangeText={setNewPin}
          style={styles.pinInput}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          placeholder={pinExists ? "New PIN (4-6 digits)" : "PIN (4-6 digits)"}
        />
        <TextInput
          value={confirmPin}
          onChangeText={setConfirmPin}
          style={styles.pinInput}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          placeholder="Confirm PIN"
        />
        {pinError && <ThemedText style={styles.errorText}>{pinError}</ThemedText>}
        {pinSuccess && <ThemedText style={styles.successText}>{pinSuccess}</ThemedText>}
        <Pressable style={({ pressed }) => [styles.pinButton, pressed && styles.pressed]} onPress={() => void handleSavePin()}>
          <ThemedText type="smallBold">{pinExists ? "Change PIN" : "Set PIN"}</ThemedText>
        </Pressable>
      </View>
      <View style={styles.dangerCard}>
        <ThemedText type="smallBold">Danger Zone</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Deleting all local data permanently removes items, attachments, settings, and app lock PIN from this device.
        </ThemedText>
        {dangerError && <ThemedText style={styles.errorText}>{dangerError}</ThemedText>}
        <Pressable
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
          onPress={() => void handleDeleteAllLocalData()}>
          <ThemedText type="smallBold">Delete All Local Data</ThemedText>
        </Pressable>
      </View>
      <View style={styles.oneDriveCard}>
        <ThemedText type="smallBold">OneDrive (Export-Only)</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Connect OneDrive only for user-triggered export/backup uploads. App works fully without it.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Redirect URI: {getOneDriveRedirectUri()}
        </ThemedText>
        <ThemedText type="small">
          Status: {oneDriveConnected ? "Connected" : "Not connected"}
        </ThemedText>
        <ThemedText type="small">
          Selected folder: {oneDriveSelectedFolder ? oneDriveSelectedFolder.path : "Not selected"}
        </ThemedText>
        {oneDriveError && <ThemedText style={styles.errorText}>{oneDriveError}</ThemedText>}
        {!oneDriveConnected ? (
          <Pressable
            style={({ pressed }) => [styles.oneDriveButton, pressed && styles.pressed]}
            onPress={() => void handleConnectOneDrive()}
            disabled={oneDriveBusy}>
            <ThemedText type="smallBold">
              {oneDriveBusy ? "Connecting..." : "Connect OneDrive"}
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.oneDriveDisconnectButton, pressed && styles.pressed]}
            onPress={() => void handleDisconnectOneDrive()}
            disabled={oneDriveBusy}>
            <ThemedText type="smallBold">
              {oneDriveBusy ? "Disconnecting..." : "Disconnect OneDrive"}
            </ThemedText>
          </Pressable>
        )}
        {oneDriveConnected && (
          <>
            <Pressable
              style={({ pressed }) => [styles.oneDriveButton, pressed && styles.pressed]}
              onPress={() => void handleLoadOneDriveFolders()}
              disabled={oneDriveBusy}>
              <ThemedText type="smallBold">
                {oneDriveBusy ? "Loading..." : "Load OneDrive Folders"}
              </ThemedText>
            </Pressable>
            {oneDriveFolders.map((folder) => (
              <Pressable
                key={folder.id}
                style={({ pressed }) => [styles.folderRow, pressed && styles.pressed]}
                onPress={() => void handleSelectOneDriveFolder(folder)}
                disabled={oneDriveBusy}>
                <ThemedText type="smallBold">{folder.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {folder.path}
                </ThemedText>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.oneDriveDisconnectButton, pressed && styles.pressed]}
              onPress={() => void handleVerifySelectedFolder()}
              disabled={oneDriveBusy || !oneDriveSelectedFolder}>
              <ThemedText type="smallBold">Verify Selected Folder Access</ThemedText>
            </Pressable>
          </>
        )}
        <Pressable
          style={({ pressed }) => [styles.oneDriveButton, pressed && styles.pressed]}
          onPress={() => void handleRunTestExport()}
          disabled={oneDriveBusy}>
          <ThemedText type="smallBold">Run Test Export Pipeline</ThemedText>
        </Pressable>
        {exportProgress && (
          <ThemedText type="small" themeColor="textSecondary">
            {exportProgress.stage.toUpperCase()}: {exportProgress.progressPercent}% - {exportProgress.message}
          </ThemedText>
        )}
        {exportResult && (
          <ThemedText type="small" themeColor="textSecondary">
            Local export file: {exportResult.localFileName}
            {exportResult.uploadStatus === "uploaded"
              ? ` | Uploaded: ${exportResult.uploadedFileName ?? exportResult.localFileName}`
              : exportResult.uploadStatus === "failed"
                ? " | Upload failed (local export still saved)"
                : " | Upload skipped"}
          </ThemedText>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#B00020",
  },
  previewCard: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.one,
    backgroundColor: "#FFFFFF",
  },
  pinCard: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: "#FFFFFF",
  },
  pinInput: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  pinButton: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#ECEDEE",
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: "#B00020",
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: "#FFF5F5",
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: "#B00020",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#FFDCDC",
  },
  oneDriveCard: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: "#FFFFFF",
  },
  oneDriveButton: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#ECEDEE",
  },
  oneDriveDisconnectButton: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  folderRow: {
    borderWidth: 1,
    borderColor: "#D6D8DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    backgroundColor: "#FFFFFF",
  },
  successText: {
    color: "#0B7D47",
  },
  pressed: {
    opacity: 0.75,
  },
});
