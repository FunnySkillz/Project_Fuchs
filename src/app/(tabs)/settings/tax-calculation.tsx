import { useRouter } from "expo-router";
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

import { estimateTaxImpact } from "@/domain/calculation-engine";
import {
  type ProfileSettingsFormInput,
  type ProfileSettingsUpsertValues,
  validateProfileSettingsFormInput,
} from "@/domain/profile-settings-validation";
import { createDefaultProfileSettings, type ProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { emitProfileSettingsSaved } from "@/services/app-events";
import { formatCents } from "@/utils/money";

type TaxDefaultsFormState = ProfileSettingsFormInput;
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

function calculatePreview(values: ProfileSettingsUpsertValues) {
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

export default function SettingsTaxCalculationRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;
  const [formState, setFormState] = useState<TaxDefaultsFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldKey, boolean>>>({});

  const scrollRef = useRef<ScrollView | null>(null);
  const fieldYRef = useRef<Partial<Record<FieldKey, number>>>({});
  const inputRef = useRef<Partial<Record<FieldKey, FocusTarget | null>>>({});

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getProfileSettingsRepository();
      const settings = await repository.getSettings();
      setFormState(createFormState(settings));
      setSubmitAttempted(false);
      setTouchedFields({});
    } catch (error) {
      console.error("Failed to load tax settings", error);
      setFormState(createFormState(createDefaultProfileSettings()));
      setLoadError("Could not load tax settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const validation = useMemo(() => {
    if (!formState) {
      return {
        valid: false,
        fieldErrors: { formState: "Settings are still loading." } as Record<string, string>,
      } as const;
    }

    return validateProfileSettingsFormInput(formState);
  }, [formState]);

  const preview = useMemo(() => {
    if (!validation.valid) {
      return null;
    }
    return calculatePreview(validation.values);
  }, [validation]);

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

  const updateFormField = <K extends keyof TaxDefaultsFormState>(
    key: K,
    value: TaxDefaultsFormState[K]
  ) => {
    setFormState((current) => (current ? { ...current, [key]: value } : current));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    setSubmitAttempted(true);
    if (!validation.valid || isSaving) {
      focusAndScrollFirstInvalid();
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const repository = await getProfileSettingsRepository();
      await repository.upsertSettings(validation.values);
      setSaveSuccess("Tax and calculation settings saved.");
      emitProfileSettingsSaved();
    } catch (error) {
      console.error("Failed to save tax settings", error);
      setSaveError("Could not save tax settings. Please retry.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !formState) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Box flex={1} px="$5" py="$6" alignItems="center" justifyContent="center">
          <VStack space="md" alignItems="center">
            <Spinner size="large" />
            <Text size="sm">Loading tax settings...</Text>
          </VStack>
        </Box>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Box flex={1} px="$5" py="$6">
        <ScrollView
          ref={scrollRef}
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
              <Heading size="xl">Tax & Calculation</Heading>
              <Text size="sm">Manage defaults used for deductible impact calculations.</Text>
            </VStack>

            {loadError && (
              <Card borderWidth="$1" borderColor="$error300">
                <Text size="sm">{loadError}</Text>
              </Card>
            )}

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <VStack
                  space="xs"
                  onLayout={(event) => {
                    fieldYRef.current.taxYearDefault = event.nativeEvent.layout.y;
                  }}
                  testID="settings-tax-input-taxYearDefault"
                >
                  <Text bold size="sm">Tax year default</Text>
                  <Input
                    variant="outline"
                    borderColor={shouldShowFieldError("taxYearDefault") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.taxYearDefault = node as FocusTarget | null;
                      }}
                      value={formState.taxYearDefault}
                      onChangeText={(value) => updateFormField("taxYearDefault", value)}
                      onBlur={() => setFieldTouched("taxYearDefault")}
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder="2026"
                      testID="settings-tax-year-input"
                      accessibilityState={
                        ({ invalid: shouldShowFieldError("taxYearDefault") } as any)
                      }
                    />
                  </Input>
                  {shouldShowFieldError("taxYearDefault") && (
                    <Text size="xs" color="$error600" testID="settings-tax-error-taxYearDefault">
                      {validation.fieldErrors.taxYearDefault}
                    </Text>
                  )}
                </VStack>

                <VStack
                  space="xs"
                  onLayout={(event) => {
                    fieldYRef.current.marginalRatePercent = event.nativeEvent.layout.y;
                  }}
                  testID="settings-tax-input-marginalRatePercent"
                >
                  <Text bold size="sm">Marginal tax rate (%)</Text>
                  <Input
                    variant="outline"
                    borderColor={shouldShowFieldError("marginalRatePercent") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.marginalRatePercent = node as FocusTarget | null;
                      }}
                      value={formState.marginalRatePercent}
                      onChangeText={(value) => updateFormField("marginalRatePercent", value)}
                      onBlur={() => setFieldTouched("marginalRatePercent")}
                      keyboardType="decimal-pad"
                      placeholder="40"
                      testID="settings-marginal-rate-input"
                      accessibilityState={
                        ({ invalid: shouldShowFieldError("marginalRatePercent") } as any)
                      }
                    />
                  </Input>
                  {shouldShowFieldError("marginalRatePercent") && (
                    <Text size="xs" color="$error600" testID="settings-tax-error-marginalRatePercent">
                      {validation.fieldErrors.marginalRatePercent}
                    </Text>
                  )}
                </VStack>

                <VStack
                  space="xs"
                  onLayout={(event) => {
                    fieldYRef.current.defaultWorkPercent = event.nativeEvent.layout.y;
                  }}
                  testID="settings-tax-input-defaultWorkPercent"
                >
                  <Text bold size="sm">Default work percent (%)</Text>
                  <Input
                    variant="outline"
                    borderColor={shouldShowFieldError("defaultWorkPercent") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.defaultWorkPercent = node as FocusTarget | null;
                      }}
                      value={formState.defaultWorkPercent}
                      onChangeText={(value) => updateFormField("defaultWorkPercent", value)}
                      onBlur={() => setFieldTouched("defaultWorkPercent")}
                      keyboardType="number-pad"
                      placeholder="100"
                      testID="settings-default-work-percent-input"
                      accessibilityState={
                        ({ invalid: shouldShowFieldError("defaultWorkPercent") } as any)
                      }
                    />
                  </Input>
                  {shouldShowFieldError("defaultWorkPercent") && (
                    <Text size="xs" color="$error600" testID="settings-tax-error-defaultWorkPercent">
                      {validation.fieldErrors.defaultWorkPercent}
                    </Text>
                  )}
                </VStack>

                <VStack
                  space="xs"
                  onLayout={(event) => {
                    fieldYRef.current.gwgThresholdEuros = event.nativeEvent.layout.y;
                  }}
                  testID="settings-tax-input-gwgThresholdEuros"
                >
                  <Text bold size="sm">GWG threshold (EUR)</Text>
                  <Input
                    variant="outline"
                    borderColor={shouldShowFieldError("gwgThresholdEuros") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.gwgThresholdEuros = node as FocusTarget | null;
                      }}
                      value={formState.gwgThresholdEuros}
                      onChangeText={(value) => updateFormField("gwgThresholdEuros", value)}
                      onBlur={() => setFieldTouched("gwgThresholdEuros")}
                      keyboardType="decimal-pad"
                      placeholder="1000.00"
                      testID="settings-gwg-threshold-input"
                      accessibilityState={
                        ({ invalid: shouldShowFieldError("gwgThresholdEuros") } as any)
                      }
                    />
                  </Input>
                  {shouldShowFieldError("gwgThresholdEuros") && (
                    <Text size="xs" color="$error600" testID="settings-tax-error-gwgThresholdEuros">
                      {validation.fieldErrors.gwgThresholdEuros}
                    </Text>
                  )}
                </VStack>

                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm">Apply half-year rule</Text>
                  <Switch
                    value={formState.applyHalfYearRule}
                    onValueChange={(value) => updateFormField("applyHalfYearRule", value)}
                  />
                </HStack>

                {saveError && <Text size="sm" color="$error600">{saveError}</Text>}
                {saveSuccess && <Text size="sm" color="$success600">{saveSuccess}</Text>}

                <Box testID="settings-tax-btn-submit">
                  <Button
                    onPress={() => void handleSave()}
                    disabled={isSubmitDisabled}
                    testID="settings-tax-save"
                  >
                    <ButtonText>{isSaving ? "Saving..." : "Save Tax Settings"}</ButtonText>
                  </Button>
                </Box>
              </VStack>
            </Card>

            {preview && (
              <Card borderWidth="$1" borderColor="$border200">
                <VStack space="xs">
                  <Heading size="sm">Calculation preview (sample item)</Heading>
                  <Text size="sm">Sample item: {formatCents(preview.sampleItemCents)}</Text>
                  <Text size="sm">Work-relevant: {formatCents(preview.workRelevantCents)}</Text>
                  <Text size="sm">
                    Deductible this year: {formatCents(preview.deductibleThisYearCents)}
                  </Text>
                  <Text size="sm">Estimated refund: {formatCents(preview.estimatedRefundCents)}</Text>
                  <Text size="sm">Mode: {preview.immediate ? "Immediate deduction" : "AfA schedule"}</Text>
                </VStack>
              </Card>
            )}
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
