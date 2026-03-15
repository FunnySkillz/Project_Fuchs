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

import { useI18n } from "@/contexts/language-context";
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
  isOneDriveConfigured,
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
  const { t } = useI18n();
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
  const [oneDriveConnecting, setOneDriveConnecting] = useState(false);
  const [oneDriveBusy, setOneDriveBusy] = useState(false);
  const [oneDriveError, setOneDriveError] = useState<string | null>(null);
  const [oneDriveFolders, setOneDriveFolders] = useState<OneDriveFolder[]>([]);
  const [oneDriveSelectedFolder, setOneDriveSelectedFolderState] =
    useState<OneDriveFolderSelection | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportPipelineResult | null>(null);
  const oneDriveConfigured = isOneDriveConfigured();

  const reloadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getProfileSettingsRepository();
      const [loaded, connected, selectedFolder] = await Promise.all([
        repository.getSettings(),
        oneDriveConfigured ? oneDriveAuthProvider.isConnected() : Promise.resolve(false),
        getSelectedOneDriveFolder(),
      ]);

      setSettings(loaded);
      setOneDriveConnected(connected);
      setOneDriveSelectedFolderState(selectedFolder);
    } catch (error) {
      console.error("Failed to load backup/sync settings", error);
      setLoadError(t("settings.backupSync.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [oneDriveConfigured, t]);

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
      setOneDriveError(t("settings.backupSync.uploadToggleError"));
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
      setBackupError(
        friendlyFileErrorMessage(error, t("settings.backupSync.localBackup.errorCreate"))
      );
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
      setBackupError(friendlyFileErrorMessage(error, t("settings.backupSync.localBackup.errorShare")));
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
      setBackupError(friendlyFileErrorMessage(error, t("settings.backupSync.localBackup.errorImport")));
    } finally {
      setConfirmImportOpen(false);
      setIsConfirmBusy(false);
    }
  };

  const handleConnectOneDrive = async () => {
    setOneDriveError(null);
    setOneDriveConnecting(true);
    setOneDriveBusy(true);
    try {
      await oneDriveAuthProvider.connect();
      setOneDriveConnected(true);
      const selected = await getSelectedOneDriveFolder();
      setOneDriveSelectedFolderState(selected);
    } catch (error) {
      console.error("Failed to connect OneDrive", error);
      setOneDriveError(t("settings.backupSync.oneDrive.connectError"));
    } finally {
      setOneDriveConnecting(false);
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
      setOneDriveError(t("settings.backupSync.oneDrive.disconnectError"));
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
        setOneDriveError(t("settings.backupSync.oneDrive.noFolders"));
      }
    } catch (error) {
      console.error("Failed to load OneDrive folders", error);
      setOneDriveError(t("settings.backupSync.oneDrive.loadFoldersError"));
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
      setOneDriveError(t("settings.backupSync.oneDrive.selectFolderError"));
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
          : t("settings.backupSync.oneDrive.selectedFolderInaccessible")
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
      message: t("settings.backupSync.oneDrive.testExportPreparing"),
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
      setOneDriveError(t("settings.backupSync.oneDrive.testExportError"));
      setExportProgress(null);
    }
  };

  const oneDriveStatusLabel = oneDriveConnected
    ? t("settings.backupSync.oneDrive.statusConnected")
    : oneDriveConnecting
      ? t("settings.backupSync.oneDrive.statusConnecting")
      : t("settings.backupSync.oneDrive.statusDisconnected");

  if (isLoading || !settings) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Box flex={1} px="$5" py="$6" alignItems="center" justifyContent="center">
          <VStack space="md" alignItems="center">
            <Spinner size="large" />
            <Text size="sm">{t("settings.backupSync.loading")}</Text>
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
                <ButtonText>{t("common.action.backToSettings")}</ButtonText>
              </Button>
            )}

            <VStack space="xs">
              <Heading size="xl">{t("settings.backupSync.title")}</Heading>
              <Text size="sm">{t("settings.backupSync.subtitle")}</Text>
            </VStack>

            {loadError && (
              <Card borderWidth="$1" borderColor="$error300">
                <Text size="sm">{loadError}</Text>
              </Card>
            )}

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md">{t("settings.backupSync.localBackup.title")}</Heading>
                {backupError && <Text size="sm" color="$error600">{backupError}</Text>}
                <HStack space="sm" flexWrap="wrap">
                  <Button action="primary" onPress={() => void handleCreateBackup()} disabled={backupBusy}>
                    <ButtonText>
                      {backupBusy
                        ? t("settings.backupSync.localBackup.working")
                        : t("settings.backupSync.localBackup.create")}
                    </ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleShareBackup()}
                    disabled={backupBusy || !backupResult}
                  >
                    <ButtonText>{t("settings.backupSync.localBackup.shareLatest")}</ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    action="negative"
                    onPress={() => setConfirmImportOpen(true)}
                    disabled={backupBusy}
                  >
                    <ButtonText>{t("settings.backupSync.localBackup.importOverwrite")}</ButtonText>
                  </Button>
                </HStack>
                {backupResult && (
                  <Text size="sm">
                    {t("settings.backupSync.localBackup.latestSummary", {
                      fileName: backupResult.fileName,
                      sizeMb: (backupResult.sizeBytes / 1024 / 1024).toFixed(2),
                      attachmentCount: backupResult.manifest.attachmentCount,
                      missingCount: backupResult.manifest.missingAttachmentCount,
                    })}
                  </Text>
                )}
                {restoreSummary && (
                  <Text
                    size="sm"
                    color={restoreSummary.missingFilesCount > 0 ? "$warning600" : "$success600"}
                  >
                    {t("settings.backupSync.localBackup.restoreSummary", {
                      itemCount: restoreSummary.itemCountRestored,
                      attachmentCount: restoreSummary.attachmentCountRestored,
                      missingCount: restoreSummary.missingFilesCount,
                    })}
                  </Text>
                )}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md">{t("settings.backupSync.oneDrive.title")}</Heading>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm">{t("settings.backupSync.oneDrive.uploadToggle")}</Text>
                  <Switch
                    value={settings.uploadToOneDriveAfterExport}
                    onValueChange={handleToggleUploadAfterExport}
                  />
                </HStack>
                <Text size="sm">
                  {t("settings.backupSync.oneDrive.redirectUri", { uri: getOneDriveRedirectUri() })}
                </Text>
                <Text size="sm">{t("settings.backupSync.oneDrive.status", { status: oneDriveStatusLabel })}</Text>
                <Text size="sm">
                  {t("settings.backupSync.oneDrive.selectedFolder", {
                    folder: oneDriveSelectedFolder
                      ? oneDriveSelectedFolder.path
                      : t("settings.backupSync.oneDrive.notSelected"),
                  })}
                </Text>
                {!oneDriveConfigured && (
                  <VStack space="xs">
                    <Text size="sm" testID="settings-onedrive-config-missing">
                      {t("settings.backupSync.oneDrive.notConfigured")}
                    </Text>
                    <Text size="xs" testID="settings-onedrive-config-hint">
                      {t("settings.backupSync.oneDrive.notConfiguredHint")}
                    </Text>
                  </VStack>
                )}
                {oneDriveError && <Text size="sm" color="$error600">{oneDriveError}</Text>}

                {oneDriveConfigured && !oneDriveConnected ? (
                  <Button
                    onPress={() => void handleConnectOneDrive()}
                    disabled={oneDriveBusy}
                    testID="settings-onedrive-connect"
                  >
                    <ButtonText>
                      {oneDriveConnecting
                        ? t("settings.backupSync.oneDrive.connecting")
                        : t("settings.backupSync.oneDrive.connect")}
                    </ButtonText>
                  </Button>
                ) : oneDriveConfigured ? (
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleDisconnectOneDrive()}
                    disabled={oneDriveBusy}
                  >
                    <ButtonText>
                      {oneDriveBusy
                        ? t("settings.backupSync.oneDrive.disconnecting")
                        : t("settings.backupSync.oneDrive.disconnect")}
                    </ButtonText>
                  </Button>
                ) : null}

                {oneDriveConnected && (
                  <>
                    <Button
                      variant="outline"
                      action="secondary"
                      onPress={() => void handleLoadOneDriveFolders()}
                      disabled={oneDriveBusy}
                    >
                      <ButtonText>
                        {oneDriveBusy
                          ? t("common.status.loading")
                          : t("settings.backupSync.oneDrive.loadFolders")}
                      </ButtonText>
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
                      <ButtonText>{t("settings.backupSync.oneDrive.verifyFolder")}</ButtonText>
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  action="secondary"
                  onPress={() => void handleRunTestExport()}
                  disabled={oneDriveBusy}
                >
                  <ButtonText>{t("settings.backupSync.oneDrive.runTestExport")}</ButtonText>
                </Button>

                {exportProgress && (
                  <Text size="sm">
                    {t("settings.backupSync.oneDrive.exportProgress", {
                      stage: exportProgress.stage.toUpperCase(),
                      percent: exportProgress.progressPercent,
                      message: exportProgress.message,
                    })}
                  </Text>
                )}
                {exportResult && (
                  <Text size="sm">
                    {exportResult.uploadStatus === "uploaded"
                      ? t("settings.backupSync.oneDrive.exportResultUploaded", {
                          localFileName: exportResult.localFileName,
                          uploadedFileName:
                            exportResult.uploadedFileName ?? exportResult.localFileName,
                        })
                      : exportResult.uploadStatus === "failed"
                        ? t("settings.backupSync.oneDrive.exportResultFailed", {
                            localFileName: exportResult.localFileName,
                          })
                        : t("settings.backupSync.oneDrive.exportResultSkipped", {
                            localFileName: exportResult.localFileName,
                          })}
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
            <Heading size="md">{t("settings.backupSync.confirmImport.title")}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text size="sm">
              {t("settings.backupSync.confirmImport.body")}
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
                <ButtonText>{t("common.action.cancel")}</ButtonText>
              </Button>
              <Button
                action="negative"
                onPress={() => void handleConfirmImport()}
                disabled={isConfirmBusy}
                testID="settings-confirm-accept"
              >
                <ButtonText>
                  {isConfirmBusy
                    ? t("settings.backupSync.localBackup.working")
                    : t("common.action.confirm")}
                </ButtonText>
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}
