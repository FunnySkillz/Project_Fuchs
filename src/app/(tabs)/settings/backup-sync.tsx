import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  Box,
  Button,
  ButtonText,
  Card,
  Heading,
  HStack,
  Spinner,
  Switch,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { type ProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { emitDatabaseRestored, emitProfileSettingsSaved } from "@/services/app-events";
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
import {
  ensureSelectedFolderAccessible,
  getOneDriveRedirectUri,
  getSelectedOneDriveFolder,
  listOneDriveFolders,
  setSelectedOneDriveFolder,
  type OneDriveFolder,
  type OneDriveFolderSelection,
} from "@/services/onedrive-auth";

WebBrowser.maybeCompleteAuthSession();
const oneDriveAuthProvider = getOneDriveAuthProvider();

export default function SettingsBackupSyncRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [backupResult, setBackupResult] = useState<BackupExportResult | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<RestoreResultSummary | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);

  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [oneDriveBusy, setOneDriveBusy] = useState(false);
  const [oneDriveError, setOneDriveError] = useState<string | null>(null);
  const [oneDriveFolders, setOneDriveFolders] = useState<OneDriveFolder[]>([]);
  const [oneDriveSelectedFolder, setOneDriveSelectedFolderState] =
    useState<OneDriveFolderSelection | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportPipelineResult | null>(null);

  const reloadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getProfileSettingsRepository();
      const [loaded, connected, selectedFolder] = await Promise.all([
        repository.getSettings(),
        oneDriveAuthProvider.isConnected(),
        getSelectedOneDriveFolder(),
      ]);

      setSettings(loaded);
      setOneDriveConnected(connected);
      setOneDriveSelectedFolderState(selectedFolder);
    } catch (error) {
      console.error("Failed to load backup/sync settings", error);
      setLoadError("Could not load backup and sync settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  const handleToggleUploadAfterExport = async (nextValue: boolean) => {
    if (!settings) {
      return;
    }

    const previous = settings.uploadToOneDriveAfterExport;
    setSettings({ ...settings, uploadToOneDriveAfterExport: nextValue });
    setOneDriveError(null);

    try {
      const repository = await getProfileSettingsRepository();
      await repository.upsertSettings({ uploadToOneDriveAfterExport: nextValue });
      emitProfileSettingsSaved();
    } catch (error) {
      console.error("Failed to update upload preference", error);
      setSettings({ ...settings, uploadToOneDriveAfterExport: previous });
      setOneDriveError("Could not update upload preference.");
    }
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

  const handleConfirmImport = async () => {
    setIsConfirmBusy(true);
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
      setConfirmImportOpen(false);
      setIsConfirmBusy(false);
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
      if (result.uploadStatus === "failed") {
        setOneDriveError(
          result.uploadError ??
            "OneDrive upload failed, but your local export was created successfully."
        );
      } else {
        setOneDriveError(null);
      }
    } catch (error) {
      console.error("Failed to run test export", error);
      setOneDriveError("Test export failed unexpectedly.");
      setExportProgress(null);
    }
  };

  if (isLoading || !settings) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Box flex={1} px="$5" py="$6" alignItems="center" justifyContent="center">
          <VStack space="md" alignItems="center">
            <Spinner size="large" />
            <Text size="sm">Loading backup and sync settings...</Text>
          </VStack>
        </Box>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Box flex={1} px="$5">
        <ScrollView
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
            {!canGoBack && (
              <Button
                variant="outline"
                action="secondary"
                alignSelf="flex-start"
                onPress={() => router.replace("/(tabs)/settings")}
                testID="settings-back-to-main-fallback"
              >
                <ButtonText>Back to Settings</ButtonText>
              </Button>
            )}

            <VStack space="xs">
              <Heading size="xl">Backup & Sync</Heading>
              <Text size="sm">Manage local backups and optional OneDrive export connectivity.</Text>
            </VStack>

            {loadError && (
              <Card borderWidth="$1" borderColor="$error300">
                <Text size="sm">{loadError}</Text>
              </Card>
            )}

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md">Local backup / restore</Heading>
                {backupError && <Text size="sm" color="$error600">{backupError}</Text>}
                <HStack space="sm" flexWrap="wrap">
                  <Button onPress={() => void handleCreateBackup()} disabled={backupBusy}>
                    <ButtonText>{backupBusy ? "Working..." : "Create backup ZIP"}</ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleShareBackup()}
                    disabled={backupBusy || !backupResult}
                  >
                    <ButtonText>Share latest backup</ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    action="negative"
                    onPress={() => setConfirmImportOpen(true)}
                    disabled={backupBusy}
                  >
                    <ButtonText>Import backup (overwrite)</ButtonText>
                  </Button>
                </HStack>
                {backupResult && (
                  <Text size="sm">
                    Latest backup: {backupResult.fileName} | Size:{" "}
                    {(backupResult.sizeBytes / 1024 / 1024).toFixed(2)} MB | Attachments:{" "}
                    {backupResult.manifest.attachmentCount} | Missing:{" "}
                    {backupResult.manifest.missingAttachmentCount}
                  </Text>
                )}
                {restoreSummary && (
                  <Text
                    size="sm"
                    color={restoreSummary.missingFilesCount > 0 ? "$warning600" : "$success600"}
                  >
                    Restored items: {restoreSummary.itemCountRestored} | Attachments:{" "}
                    {restoreSummary.attachmentCountRestored} | Missing files:{" "}
                    {restoreSummary.missingFilesCount}
                  </Text>
                )}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md">OneDrive (export-only)</Heading>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm">Upload to OneDrive after export</Text>
                  <Switch
                    value={settings.uploadToOneDriveAfterExport}
                    onValueChange={handleToggleUploadAfterExport}
                  />
                </HStack>
                <Text size="sm">Redirect URI: {getOneDriveRedirectUri()}</Text>
                <Text size="sm">Status: {oneDriveConnected ? "Connected" : "Not connected"}</Text>
                <Text size="sm">
                  Selected folder: {oneDriveSelectedFolder ? oneDriveSelectedFolder.path : "Not selected"}
                </Text>
                {oneDriveError && <Text size="sm" color="$error600">{oneDriveError}</Text>}

                {!oneDriveConnected ? (
                  <Button onPress={() => void handleConnectOneDrive()} disabled={oneDriveBusy}>
                    <ButtonText>{oneDriveBusy ? "Connecting..." : "Connect OneDrive"}</ButtonText>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleDisconnectOneDrive()}
                    disabled={oneDriveBusy}
                  >
                    <ButtonText>{oneDriveBusy ? "Disconnecting..." : "Disconnect OneDrive"}</ButtonText>
                  </Button>
                )}

                {oneDriveConnected && (
                  <>
                    <Button
                      variant="outline"
                      action="secondary"
                      onPress={() => void handleLoadOneDriveFolders()}
                      disabled={oneDriveBusy}
                    >
                      <ButtonText>{oneDriveBusy ? "Loading..." : "Load OneDrive folders"}</ButtonText>
                    </Button>
                    {oneDriveFolders.map((folder) => (
                      <Button
                        key={folder.id}
                        variant="outline"
                        action="secondary"
                        onPress={() => void handleSelectOneDriveFolder(folder)}
                        disabled={oneDriveBusy}
                      >
                        <ButtonText>{folder.path}</ButtonText>
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      action="secondary"
                      onPress={() => void handleVerifySelectedFolder()}
                      disabled={oneDriveBusy || !oneDriveSelectedFolder}
                    >
                      <ButtonText>Verify selected folder access</ButtonText>
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  action="secondary"
                  onPress={() => void handleRunTestExport()}
                  disabled={oneDriveBusy}
                >
                  <ButtonText>Run test export pipeline</ButtonText>
                </Button>

                {exportProgress && (
                  <Text size="sm">
                    {exportProgress.stage.toUpperCase()}: {exportProgress.progressPercent}% -{" "}
                    {exportProgress.message}
                  </Text>
                )}
                {exportResult && (
                  <Text size="sm">
                    Local file: {exportResult.localFileName}
                    {exportResult.uploadStatus === "uploaded"
                      ? ` | Uploaded: ${exportResult.uploadedFileName ?? exportResult.localFileName}`
                      : exportResult.uploadStatus === "failed"
                        ? " | Upload failed (local export still saved)"
                        : " | Upload skipped"}
                  </Text>
                )}
              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </Box>

      <AlertDialog isOpen={confirmImportOpen} onClose={() => setConfirmImportOpen(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="md">Import backup snapshot?</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text size="sm">
              Importing backup will overwrite your current local data, including DB and
              attachment files. This action cannot be undone.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <HStack space="sm">
              <Button
                variant="outline"
                action="secondary"
                onPress={() => setConfirmImportOpen(false)}
                disabled={isConfirmBusy}
                testID="settings-confirm-cancel"
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                action="negative"
                onPress={() => void handleConfirmImport()}
                disabled={isConfirmBusy}
                testID="settings-confirm-accept"
              >
                <ButtonText>{isConfirmBusy ? "Working..." : "Confirm"}</ButtonText>
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}
