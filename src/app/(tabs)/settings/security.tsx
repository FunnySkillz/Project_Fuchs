import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { useI18n } from "@/contexts/language-context";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { emitProfileSettingsSaved } from "@/services/app-events";
import { hasPinAsync, isValidPin, setPinAsync, verifyPinAsync } from "@/services/pin-auth";

type PinFieldKey = "currentPin" | "newPin" | "confirmPin";
const pinFieldOrder: PinFieldKey[] = ["currentPin", "newPin", "confirmPin"];

type FocusTarget = {
  focus?: () => void;
};

export default function SettingsSecurityRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAppLock, setIsSavingAppLock] = useState(false);
  const [isConfirmingAppLock, setIsConfirmingAppLock] = useState(false);
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
  const [pinSubmitAttempted, setPinSubmitAttempted] = useState(false);
  const [pinTouchedFields, setPinTouchedFields] = useState<Partial<Record<PinFieldKey, boolean>>>({});
  const [currentPinVerificationError, setCurrentPinVerificationError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const pinFieldYRef = useRef<Partial<Record<PinFieldKey, number>>>({});
  const pinInputRef = useRef<Partial<Record<PinFieldKey, FocusTarget | null>>>({});
  const isAuthenticatingRef = useRef(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getProfileSettingsRepository();
      const [settings, hasPin] = await Promise.all([repository.getSettings(), hasPinAsync()]);
      setAppLockEnabled(settings.appLockEnabled);
      setPinExists(hasPin);
      setPinSubmitAttempted(false);
      setPinTouchedFields({});
      setCurrentPinVerificationError(null);
    } catch (error) {
      console.error("Failed to load security settings", error);
      setLoadError(t("settings.security.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const confirmEnableAppLock = useCallback(async () => {
    if (isAuthenticatingRef.current) {
      return false;
    }

    isAuthenticatingRef.current = true;
    setIsConfirmingAppLock(true);
    setSaveError(null);
    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);

      if (!hasHardware || !isEnrolled) {
        setSaveError(t("settings.security.appLock.biometricUnavailable"));
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t("settings.security.appLock.confirmPrompt"),
        cancelLabel: t("common.action.cancel"),
        disableDeviceFallback: false,
      });

      if (!result.success) {
        setSaveError(
          result.error === "user_cancel"
            ? t("settings.security.appLock.confirmCanceled")
            : t("settings.security.appLock.confirmFailed")
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to confirm biometric activation", error);
      setSaveError(t("settings.security.appLock.confirmError"));
      return false;
    } finally {
      isAuthenticatingRef.current = false;
      setIsConfirmingAppLock(false);
    }
  }, [t]);

  const handleToggleAppLock = async (nextValue: boolean) => {
    if (isSavingAppLock || isConfirmingAppLock || isAuthenticatingRef.current) {
      return;
    }

    const previous = appLockEnabled;
    if (nextValue === previous) {
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);

    if (nextValue) {
      const confirmed = await confirmEnableAppLock();
      if (!confirmed) {
        setAppLockEnabled(previous);
        return;
      }
    }

    setAppLockEnabled(nextValue);
    setIsSavingAppLock(true);

    try {
      const repository = await getProfileSettingsRepository();
      await repository.upsertSettings({ appLockEnabled: nextValue });
      setSaveSuccess(t("settings.security.appLock.saved"));
      emitProfileSettingsSaved();
    } catch (error) {
      console.error("Failed to update app lock setting", error);
      setAppLockEnabled(previous);
      setSaveError(t("settings.security.appLock.saveError"));
    } finally {
      setIsSavingAppLock(false);
    }
  };

  const pinValidationErrors = useMemo(() => {
    const errors: Partial<Record<PinFieldKey, string>> = {};

    if (pinExists && currentPin.trim().length === 0) {
      errors.currentPin = t("settings.security.pin.currentRequired");
    }

    if (!isValidPin(newPin)) {
      errors.newPin = t("settings.security.pin.invalidFormat");
    }

    if (confirmPin.trim().length === 0) {
      errors.confirmPin = t("settings.security.pin.confirmRequired");
    } else if (newPin !== confirmPin) {
      errors.confirmPin = t("settings.security.pin.confirmMismatch");
    }

    if (currentPinVerificationError) {
      errors.currentPin = currentPinVerificationError;
    }

    return errors;
  }, [confirmPin, currentPin, currentPinVerificationError, newPin, pinExists, t]);

  const isPinFormValid = Object.keys(pinValidationErrors).length === 0;
  const isPinSubmitDisabled = (pinSubmitAttempted && !isPinFormValid) || isSavingPin;

  const shouldShowPinFieldError = useCallback(
    (field: PinFieldKey) =>
      Boolean((pinSubmitAttempted || pinTouchedFields[field]) && pinValidationErrors[field]),
    [pinSubmitAttempted, pinTouchedFields, pinValidationErrors]
  );

  const setPinFieldTouched = useCallback((field: PinFieldKey) => {
    setPinTouchedFields((current) => ({ ...current, [field]: true }));
  }, []);

  const scrollToPinField = useCallback((field: PinFieldKey) => {
    const y = pinFieldYRef.current[field];
    if (typeof y !== "number") {
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
  }, []);

  const focusPinField = useCallback((field: PinFieldKey) => {
    const target = pinInputRef.current[field];
    if (!target || typeof target.focus !== "function") {
      return;
    }
    requestAnimationFrame(() => {
      target.focus?.();
    });
  }, []);

  const focusAndScrollFirstPinError = useCallback(() => {
    const firstInvalid = pinFieldOrder.find((field) => pinValidationErrors[field]);
    if (!firstInvalid) {
      return;
    }
    scrollToPinField(firstInvalid);
    focusPinField(firstInvalid);
  }, [focusPinField, pinValidationErrors, scrollToPinField]);

  const handleSavePin = async () => {
    if (isSavingPin) {
      return;
    }

    setPinSubmitAttempted(true);
    setPinError(null);
    setPinSuccess(null);
    setCurrentPinVerificationError(null);

    if (!isPinFormValid) {
      focusAndScrollFirstPinError();
      return;
    }

    setIsSavingPin(true);
    try {
      if (pinExists) {
        const check = await verifyPinAsync(currentPin);
        if (!check.success) {
          setCurrentPinVerificationError(t("settings.security.pin.currentIncorrect"));
          setPinError(t("settings.security.pin.currentIncorrect"));
          focusPinField("currentPin");
          scrollToPinField("currentPin");
          return;
        }
      }

      await setPinAsync(newPin);
      setPinExists(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setPinSubmitAttempted(false);
      setPinTouchedFields({});
      setCurrentPinVerificationError(null);
      setPinSuccess(t("settings.security.pin.saved"));
    } catch (error) {
      console.error("Failed to save PIN", error);
      setPinError(t("settings.security.pin.saveError"));
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
            <Text size="sm">{t("settings.security.loading")}</Text>
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
              <Heading size="xl">{t("settings.security.title")}</Heading>
              <Text size="sm">{t("settings.security.subtitle")}</Text>
            </VStack>

            {loadError && (
              <Card borderWidth="$1" borderColor="$error300">
                <Text size="sm">{loadError}</Text>
              </Card>
            )}

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md">{t("settings.security.appLock.title")}</Heading>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm">{t("settings.security.appLock.toggleLabel")}</Text>
                  <Switch
                    value={appLockEnabled}
                    onValueChange={handleToggleAppLock}
                    isDisabled={isSavingAppLock || isConfirmingAppLock}
                    testID="settings-security-app-lock-toggle"
                  />
                </HStack>
                {saveError && <Text size="sm" color="$error600">{saveError}</Text>}
                {saveSuccess && <Text size="sm" color="$success600">{saveSuccess}</Text>}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md">{t("settings.security.pin.title")}</Heading>
                <Text size="sm">
                  {pinExists
                    ? t("settings.security.pin.configured")
                    : t("settings.security.pin.notConfigured")}
                </Text>

                {pinExists && (
                  <VStack
                    space="xs"
                    onLayout={(event) => {
                      pinFieldYRef.current.currentPin = event.nativeEvent.layout.y;
                    }}
                    testID="settings-security-input-currentPin"
                  >
                    <Input
                      variant="outline"
                      borderColor={shouldShowPinFieldError("currentPin") ? "$error600" : "$border200"}
                    >
                      <InputField
                        ref={(node) => {
                          pinInputRef.current.currentPin = node as FocusTarget | null;
                        }}
                        value={currentPin}
                        onChangeText={(value) => {
                          setCurrentPin(value);
                          setCurrentPinVerificationError(null);
                          setPinError(null);
                        }}
                        onBlur={() => setPinFieldTouched("currentPin")}
                        secureTextEntry
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder={t("settings.security.pin.currentPlaceholder")}
                        testID="settings-security-current-pin-input"
                        accessibilityState={
                          ({ invalid: shouldShowPinFieldError("currentPin") } as any)
                        }
                      />
                    </Input>
                    {shouldShowPinFieldError("currentPin") ? (
                      <Text size="xs" color="$error600" testID="settings-security-error-currentPin">
                        {pinValidationErrors.currentPin}
                      </Text>
                    ) : null}
                  </VStack>
                )}

                <VStack
                  space="xs"
                  onLayout={(event) => {
                    pinFieldYRef.current.newPin = event.nativeEvent.layout.y;
                  }}
                  testID="settings-security-input-newPin"
                >
                  <Input
                    variant="outline"
                    borderColor={shouldShowPinFieldError("newPin") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        pinInputRef.current.newPin = node as FocusTarget | null;
                      }}
                      value={newPin}
                      onChangeText={setNewPin}
                      onBlur={() => setPinFieldTouched("newPin")}
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder={
                        pinExists
                          ? t("settings.security.pin.newPlaceholder")
                          : t("settings.security.pin.firstPlaceholder")
                      }
                      testID="settings-security-new-pin-input"
                      accessibilityState={
                        ({ invalid: shouldShowPinFieldError("newPin") } as any)
                      }
                    />
                  </Input>
                  {shouldShowPinFieldError("newPin") ? (
                    <Text size="xs" color="$error600" testID="settings-security-error-newPin">
                      {pinValidationErrors.newPin}
                    </Text>
                  ) : null}
                </VStack>

                <VStack
                  space="xs"
                  onLayout={(event) => {
                    pinFieldYRef.current.confirmPin = event.nativeEvent.layout.y;
                  }}
                  testID="settings-security-input-confirmPin"
                >
                  <Input
                    variant="outline"
                    borderColor={shouldShowPinFieldError("confirmPin") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        pinInputRef.current.confirmPin = node as FocusTarget | null;
                      }}
                      value={confirmPin}
                      onChangeText={setConfirmPin}
                      onBlur={() => setPinFieldTouched("confirmPin")}
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder={t("settings.security.pin.confirmPlaceholder")}
                      testID="settings-security-confirm-pin-input"
                      accessibilityState={
                        ({ invalid: shouldShowPinFieldError("confirmPin") } as any)
                      }
                    />
                  </Input>
                  {shouldShowPinFieldError("confirmPin") ? (
                    <Text size="xs" color="$error600" testID="settings-security-error-confirmPin">
                      {pinValidationErrors.confirmPin}
                    </Text>
                  ) : null}
                </VStack>

                {pinError && <Text size="sm" color="$error600">{pinError}</Text>}
                {pinSuccess && <Text size="sm" color="$success600">{pinSuccess}</Text>}

                <Box testID="settings-security-btn-submit">
                  <Button
                    variant="outline"
                    action="secondary"
                    onPress={() => void handleSavePin()}
                    disabled={isPinSubmitDisabled}
                    testID="settings-security-save-pin"
                  >
                    <ButtonText>
                      {isSavingPin
                        ? t("settings.security.pin.saving")
                        : pinExists
                          ? t("settings.security.pin.change")
                          : t("settings.security.pin.set")}
                    </ButtonText>
                  </Button>
                </Box>
              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
