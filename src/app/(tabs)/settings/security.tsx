import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Box,
  Button,
  ButtonText,
  Card,
  Heading,
  HStack,
  Input,
  InputField,
  Spinner,
  Switch,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { emitProfileSettingsSaved } from "@/services/app-events";
import { hasPinAsync, isValidPin, setPinAsync, verifyPinAsync } from "@/services/pin-auth";

export default function SettingsSecurityRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAppLock, setIsSavingAppLock] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [pinExists, setPinExists] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getProfileSettingsRepository();
      const [settings, hasPin] = await Promise.all([repository.getSettings(), hasPinAsync()]);
      setAppLockEnabled(settings.appLockEnabled);
      setPinExists(hasPin);
    } catch (error) {
      console.error("Failed to load security settings", error);
      setLoadError("Could not load security settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleToggleAppLock = async (nextValue: boolean) => {
    if (isSavingAppLock) {
      return;
    }

    const previous = appLockEnabled;
    setAppLockEnabled(nextValue);
    setSaveError(null);
    setSaveSuccess(null);
    setIsSavingAppLock(true);

    try {
      const repository = await getProfileSettingsRepository();
      await repository.upsertSettings({ appLockEnabled: nextValue });
      setSaveSuccess("Security settings saved.");
      emitProfileSettingsSaved();
    } catch (error) {
      console.error("Failed to update app lock setting", error);
      setAppLockEnabled(previous);
      setSaveError("Could not update app lock setting.");
    } finally {
      setIsSavingAppLock(false);
    }
  };

  const handleSavePin = async () => {
    if (isSavingPin) {
      return;
    }

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

    setIsSavingPin(true);
    try {
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
    } catch (error) {
      console.error("Failed to save PIN", error);
      setPinError("Could not save PIN.");
    } finally {
      setIsSavingPin(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Box flex={1} px="$5" py="$6" alignItems="center" justifyContent="center">
          <VStack space="md" alignItems="center">
            <Spinner size="large" />
            <Text size="sm">Loading security settings...</Text>
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
              <Heading size="xl">Security</Heading>
              <Text size="sm">Control lock behavior and PIN fallback on this device.</Text>
            </VStack>

            {loadError && (
              <Card borderWidth="$1" borderColor="$error300">
                <Text size="sm">{loadError}</Text>
              </Card>
            )}

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md">App lock</Heading>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm">Require biometric/PIN unlock on resume</Text>
                  <Switch value={appLockEnabled} onValueChange={handleToggleAppLock} />
                </HStack>
                {saveError && <Text size="sm" color="$error600">{saveError}</Text>}
                {saveSuccess && <Text size="sm" color="$success600">{saveSuccess}</Text>}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md">PIN fallback</Heading>
                <Text size="sm">
                  {pinExists ? "PIN is configured. You can change it below." : "Set a PIN fallback for app lock."}
                </Text>

                {pinExists && (
                  <Input variant="outline">
                    <InputField
                      value={currentPin}
                      onChangeText={setCurrentPin}
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="Current PIN"
                    />
                  </Input>
                )}

                <Input variant="outline">
                  <InputField
                    value={newPin}
                    onChangeText={setNewPin}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder={pinExists ? "New PIN (4-6 digits)" : "PIN (4-6 digits)"}
                  />
                </Input>

                <Input variant="outline">
                  <InputField
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="Confirm PIN"
                  />
                </Input>

                {pinError && <Text size="sm" color="$error600">{pinError}</Text>}
                {pinSuccess && <Text size="sm" color="$success600">{pinSuccess}</Text>}

                <Button
                  variant="outline"
                  action="secondary"
                  onPress={() => void handleSavePin()}
                  disabled={isSavingPin}
                  testID="settings-security-save-pin"
                >
                  <ButtonText>
                    {isSavingPin ? "Saving PIN..." : pinExists ? "Change PIN" : "Set PIN"}
                  </ButtonText>
                </Button>
              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
