import { useRouter } from "expo-router";
import React, { useState } from "react";
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
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { useThemeMode } from "@/contexts/theme-mode-context";
import { emitLocalDataDeleted } from "@/services/app-events";
import { deleteAllLocalData } from "@/services/local-data";

export default function SettingsDangerZoneRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setMode } = useThemeMode();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  const handleDeleteAllLocalData = async () => {
    setIsConfirmBusy(true);
    setDangerError(null);
    try {
      await deleteAllLocalData();
      emitLocalDataDeleted();
      setMode("system");
    } catch (error) {
      console.error("Failed to delete local data", error);
      setDangerError("Could not delete local data. Please retry.");
    } finally {
      setConfirmOpen(false);
      setIsConfirmBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Box flex={1} px="$5" py="$6" style={{ paddingBottom: insets.bottom + 24 }}>
        <VStack space="lg" maxWidth={860} width="$full" alignSelf="center">
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
            <Heading size="xl">Danger Zone</Heading>
            <Text size="sm">Destructive actions for local device data.</Text>
          </VStack>

          <Card borderWidth="$1" borderColor="$error300">
            <VStack space="md">
              <Text size="sm">
                Delete all local data (items, attachments, settings, and PIN) from this device.
              </Text>
              {dangerError && <Text size="sm" color="$error600">{dangerError}</Text>}
              <Button
                action="negative"
                variant="outline"
                onPress={() => setConfirmOpen(true)}
                testID="settings-delete-local-data"
              >
                <ButtonText>Delete all local data</ButtonText>
              </Button>
            </VStack>
          </Card>
        </VStack>
      </Box>

      <AlertDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="md">Delete all local data?</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text size="sm">
              This action is irreversible and removes all local app data from this device.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <HStack space="sm">
              <Button
                variant="outline"
                action="secondary"
                onPress={() => setConfirmOpen(false)}
                disabled={isConfirmBusy}
                testID="settings-confirm-cancel"
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                action="negative"
                onPress={() => void handleDeleteAllLocalData()}
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
