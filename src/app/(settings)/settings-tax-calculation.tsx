import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  const insets = useSafeAreaInsets();
  const [formState, setFormState] = useState<TaxDefaultsFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getProfileSettingsRepository();
      const settings = await repository.getSettings();
      setFormState(createFormState(settings));
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

  const updateFormField = <K extends keyof TaxDefaultsFormState>(
    key: K,
    value: TaxDefaultsFormState[K]
  ) => {
    setFormState((current) => (current ? { ...current, [key]: value } : current));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    if (!validation.valid || isSaving) {
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
          contentContainerStyle={{
            width: "100%",
            maxWidth: 860,
            alignSelf: "center",
            paddingBottom: insets.bottom + 24,
          }}
        >
          <VStack space="lg">
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
                <VStack space="xs">
                  <Text bold size="sm">Tax year default</Text>
                  <Input variant="outline">
                    <InputField
                      value={formState.taxYearDefault}
                      onChangeText={(value) => updateFormField("taxYearDefault", value)}
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder="2026"
                      testID="settings-tax-year-input"
                    />
                  </Input>
                  {validation.fieldErrors.taxYearDefault && (
                    <Text size="xs" color="$error600">{validation.fieldErrors.taxYearDefault}</Text>
                  )}
                </VStack>

                <VStack space="xs">
                  <Text bold size="sm">Marginal tax rate (%)</Text>
                  <Input variant="outline">
                    <InputField
                      value={formState.marginalRatePercent}
                      onChangeText={(value) => updateFormField("marginalRatePercent", value)}
                      keyboardType="decimal-pad"
                      placeholder="40"
                      testID="settings-marginal-rate-input"
                    />
                  </Input>
                  {validation.fieldErrors.marginalRatePercent && (
                    <Text size="xs" color="$error600">{validation.fieldErrors.marginalRatePercent}</Text>
                  )}
                </VStack>

                <VStack space="xs">
                  <Text bold size="sm">Default work percent (%)</Text>
                  <Input variant="outline">
                    <InputField
                      value={formState.defaultWorkPercent}
                      onChangeText={(value) => updateFormField("defaultWorkPercent", value)}
                      keyboardType="number-pad"
                      placeholder="100"
                      testID="settings-default-work-percent-input"
                    />
                  </Input>
                  {validation.fieldErrors.defaultWorkPercent && (
                    <Text size="xs" color="$error600">{validation.fieldErrors.defaultWorkPercent}</Text>
                  )}
                </VStack>

                <VStack space="xs">
                  <Text bold size="sm">GWG threshold (EUR)</Text>
                  <Input variant="outline">
                    <InputField
                      value={formState.gwgThresholdEuros}
                      onChangeText={(value) => updateFormField("gwgThresholdEuros", value)}
                      keyboardType="decimal-pad"
                      placeholder="1000.00"
                      testID="settings-gwg-threshold-input"
                    />
                  </Input>
                  {validation.fieldErrors.gwgThresholdEuros && (
                    <Text size="xs" color="$error600">{validation.fieldErrors.gwgThresholdEuros}</Text>
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

                <Button
                  onPress={() => void handleSave()}
                  disabled={!validation.valid || isSaving}
                  testID="settings-tax-save"
                >
                  <ButtonText>{isSaving ? "Saving..." : "Save Tax Settings"}</ButtonText>
                </Button>
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
