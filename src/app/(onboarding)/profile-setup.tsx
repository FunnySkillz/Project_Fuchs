import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Box,
  Button,
  ButtonText,
  Card,
  Heading,
  Input,
  InputField,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { useI18n } from "@/contexts/language-context";
import { validateProfileSettingsFormInput } from "@/domain/profile-settings-validation";
import { createDefaultProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { emitProfileSettingsSaved } from "@/services/app-events";

type FieldKey =
  | "taxYearDefault"
  | "marginalRatePercent"
  | "defaultWorkPercent"
  | "gwgThresholdEuros";

const fieldOrder: FieldKey[] = [
  "taxYearDefault",
  "marginalRatePercent",
  "defaultWorkPercent",
  "gwgThresholdEuros",
];

type FocusTarget = {
  focus?: () => void;
};

export default function OnboardingProfileSetupRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const defaults = useMemo(() => createDefaultProfileSettings(), []);

  const [taxYearDefault, setTaxYearDefault] = useState(String(defaults.taxYearDefault));
  const [marginalRatePercent, setMarginalRatePercent] = useState(
    String(defaults.marginalRateBps / 100)
  );
  const [defaultWorkPercent, setDefaultWorkPercent] = useState(String(defaults.defaultWorkPercent));
  const [gwgThresholdEuros, setGwgThresholdEuros] = useState(
    (defaults.gwgThresholdCents / 100).toFixed(2)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldKey, boolean>>>({});

  const scrollRef = useRef<ScrollView | null>(null);
  const fieldYRef = useRef<Partial<Record<FieldKey, number>>>({});
  const inputRef = useRef<Partial<Record<FieldKey, FocusTarget | null>>>({});

  const validation = useMemo(
    () =>
      validateProfileSettingsFormInput({
        taxYearDefault,
        marginalRatePercent,
        defaultWorkPercent,
        gwgThresholdEuros,
        applyHalfYearRule: false,
        appLockEnabled: false,
        uploadToOneDriveAfterExport: false,
      }),
    [defaultWorkPercent, gwgThresholdEuros, marginalRatePercent, taxYearDefault]
  );

  const shouldShowFieldError = useCallback(
    (field: FieldKey) => Boolean((submitAttempted || touchedFields[field]) && validation.fieldErrors[field]),
    [submitAttempted, touchedFields, validation.fieldErrors]
  );

  const isSubmitDisabled = (submitAttempted && !validation.valid) || isSaving;

  const setFieldTouched = useCallback((field: FieldKey) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }, []);

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

  const focusAndScrollFirstInvalid = useCallback(() => {
    const firstInvalid = fieldOrder.find((field) => validation.fieldErrors[field]);
    if (!firstInvalid) {
      return;
    }
    scrollToField(firstInvalid);
    focusField(firstInvalid);
  }, [focusField, scrollToField, validation.fieldErrors]);

  const saveProfileSettings = async () => {
    setSubmitAttempted(true);
    if (!validation.valid || !validation.values || isSaving) {
      focusAndScrollFirstInvalid();
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const repository = await getProfileSettingsRepository();
      await repository.upsertSettings(validation.values);
      emitProfileSettingsSaved();
      router.replace("/(tabs)/home");
    } catch (error) {
      console.error("Failed to save onboarding profile settings", error);
      setSaveError(t("onboarding.profileSetup.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <Box flex={1}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <VStack space="lg">
          <VStack space="xs">
            <Heading size="2xl" textAlign="center">
              {t("onboarding.profileSetup.title")}
            </Heading>
            <Text size="sm" textAlign="center">
              {t("onboarding.profileSetup.subtitle")}
            </Text>
          </VStack>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <VStack
                space="xs"
                onLayout={(event) => {
                  fieldYRef.current.taxYearDefault = event.nativeEvent.layout.y;
                }}
                testID="onboarding-profile-input-taxYearDefault"
              >
                <Text bold size="sm">
                  {t("onboarding.profileSetup.taxYearDefault")}
                </Text>
                <Input
                  variant="outline"
                  borderColor={shouldShowFieldError("taxYearDefault") ? "$error600" : "$border200"}
                >
                  <InputField
                    ref={(node) => {
                      inputRef.current.taxYearDefault = node as FocusTarget | null;
                    }}
                    value={taxYearDefault}
                    onChangeText={setTaxYearDefault}
                    onBlur={() => setFieldTouched("taxYearDefault")}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="2026"
                    testID="onboarding-profile-tax-year-input"
                    accessibilityState={
                      ({ invalid: shouldShowFieldError("taxYearDefault") } as any)
                    }
                  />
                </Input>
                {shouldShowFieldError("taxYearDefault") ? (
                  <Text size="xs" color="$error600" testID="onboarding-profile-error-taxYearDefault">
                    {validation.fieldErrors.taxYearDefault}
                  </Text>
                ) : null}
              </VStack>

              <VStack
                space="xs"
                onLayout={(event) => {
                  fieldYRef.current.marginalRatePercent = event.nativeEvent.layout.y;
                }}
                testID="onboarding-profile-input-marginalRatePercent"
              >
                <Text bold size="sm">
                  {t("onboarding.profileSetup.marginalRatePercent")}
                </Text>
                <Input
                  variant="outline"
                  borderColor={shouldShowFieldError("marginalRatePercent") ? "$error600" : "$border200"}
                >
                  <InputField
                    ref={(node) => {
                      inputRef.current.marginalRatePercent = node as FocusTarget | null;
                    }}
                    value={marginalRatePercent}
                    onChangeText={setMarginalRatePercent}
                    onBlur={() => setFieldTouched("marginalRatePercent")}
                    keyboardType="decimal-pad"
                    placeholder="40"
                    testID="onboarding-profile-rate-input"
                    accessibilityState={
                      ({ invalid: shouldShowFieldError("marginalRatePercent") } as any)
                    }
                  />
                </Input>
                {shouldShowFieldError("marginalRatePercent") ? (
                  <Text size="xs" color="$error600" testID="onboarding-profile-error-marginalRatePercent">
                    {validation.fieldErrors.marginalRatePercent}
                  </Text>
                ) : null}
              </VStack>

              <VStack
                space="xs"
                onLayout={(event) => {
                  fieldYRef.current.defaultWorkPercent = event.nativeEvent.layout.y;
                }}
                testID="onboarding-profile-input-defaultWorkPercent"
              >
                <Text bold size="sm">
                  {t("onboarding.profileSetup.defaultWorkPercent")}
                </Text>
                <Input
                  variant="outline"
                  borderColor={shouldShowFieldError("defaultWorkPercent") ? "$error600" : "$border200"}
                >
                  <InputField
                    ref={(node) => {
                      inputRef.current.defaultWorkPercent = node as FocusTarget | null;
                    }}
                    value={defaultWorkPercent}
                    onChangeText={setDefaultWorkPercent}
                    onBlur={() => setFieldTouched("defaultWorkPercent")}
                    keyboardType="number-pad"
                    placeholder="100"
                    testID="onboarding-profile-work-percent-input"
                    accessibilityState={
                      ({ invalid: shouldShowFieldError("defaultWorkPercent") } as any)
                    }
                  />
                </Input>
                {shouldShowFieldError("defaultWorkPercent") ? (
                  <Text size="xs" color="$error600" testID="onboarding-profile-error-defaultWorkPercent">
                    {validation.fieldErrors.defaultWorkPercent}
                  </Text>
                ) : null}
              </VStack>

              <VStack
                space="xs"
                onLayout={(event) => {
                  fieldYRef.current.gwgThresholdEuros = event.nativeEvent.layout.y;
                }}
                testID="onboarding-profile-input-gwgThresholdEuros"
              >
                <Text bold size="sm">
                  {t("onboarding.profileSetup.gwgThreshold")}
                </Text>
                <Input
                  variant="outline"
                  borderColor={shouldShowFieldError("gwgThresholdEuros") ? "$error600" : "$border200"}
                >
                  <InputField
                    ref={(node) => {
                      inputRef.current.gwgThresholdEuros = node as FocusTarget | null;
                    }}
                    value={gwgThresholdEuros}
                    onChangeText={setGwgThresholdEuros}
                    onBlur={() => setFieldTouched("gwgThresholdEuros")}
                    keyboardType="decimal-pad"
                    placeholder="1000.00"
                    testID="onboarding-profile-gwg-input"
                    accessibilityState={
                      ({ invalid: shouldShowFieldError("gwgThresholdEuros") } as any)
                    }
                  />
                </Input>
                {shouldShowFieldError("gwgThresholdEuros") ? (
                  <Text size="xs" color="$error600" testID="onboarding-profile-error-gwgThresholdEuros">
                    {validation.fieldErrors.gwgThresholdEuros}
                  </Text>
                ) : null}
              </VStack>
            </VStack>
          </Card>

          {saveError ? (
            <Card borderWidth="$1" borderColor="$error300">
              <VStack space="sm">
                <Text size="sm">{saveError}</Text>
                <Button
                  variant="outline"
                  action="secondary"
                  alignSelf="flex-start"
                  onPress={() => void saveProfileSettings()}
                  disabled={isSubmitDisabled}
                >
                  <ButtonText>{t("onboarding.profileSetup.retrySave")}</ButtonText>
                </Button>
              </VStack>
            </Card>
          ) : null}

          <Box testID="onboarding-profile-btn-submit">
            <Button
              onPress={() => void saveProfileSettings()}
              disabled={isSubmitDisabled}
              testID="onboarding-profile-save"
            >
              <ButtonText>
                {isSaving ? t("onboarding.profileSetup.saving") : t("onboarding.profileSetup.saveAndContinue")}
              </ButtonText>
            </Button>
          </Box>
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
