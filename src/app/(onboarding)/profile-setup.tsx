import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView } from "react-native";
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

import { createDefaultProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { emitProfileSettingsSaved } from "@/services/app-events";

interface ProfileSetupValues {
  taxYearDefault: number;
  marginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: boolean;
  appLockEnabled: boolean;
  uploadToOneDriveAfterExport: boolean;
}

interface ProfileSetupValidation {
  valid: boolean;
  values?: ProfileSetupValues;
  fieldErrors: Record<string, string>;
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

function validateProfileSetupInput(
  taxYearDefault: string,
  marginalRatePercent: string,
  defaultWorkPercent: string,
  gwgThresholdEuros: string
): ProfileSetupValidation {
  const fieldErrors: Record<string, string> = {};

  const parsedTaxYear = parseNumber(taxYearDefault);
  if (parsedTaxYear === null || !Number.isInteger(parsedTaxYear)) {
    fieldErrors.taxYearDefault = "Tax year must be a whole number.";
  } else if (parsedTaxYear < 2000 || parsedTaxYear > 2100) {
    fieldErrors.taxYearDefault = "Tax year must be between 2000 and 2100.";
  }

  const parsedRate = parseNumber(marginalRatePercent);
  if (parsedRate === null) {
    fieldErrors.marginalRatePercent = "Marginal tax rate is required.";
  } else if (parsedRate < 0 || parsedRate > 55) {
    fieldErrors.marginalRatePercent = "Marginal tax rate must be between 0 and 55%.";
  }

  const parsedWorkPercent = parseNumber(defaultWorkPercent);
  if (parsedWorkPercent === null) {
    fieldErrors.defaultWorkPercent = "Default work percent is required.";
  } else if (parsedWorkPercent < 0 || parsedWorkPercent > 100) {
    fieldErrors.defaultWorkPercent = "Default work percent must be between 0 and 100%.";
  }

  const parsedGwgThreshold = parseNumber(gwgThresholdEuros);
  if (parsedGwgThreshold === null) {
    fieldErrors.gwgThresholdEuros = "GWG threshold is required.";
  } else if (parsedGwgThreshold < 0) {
    fieldErrors.gwgThresholdEuros = "GWG threshold must be 0 or higher.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }

  return {
    valid: true,
    fieldErrors,
    values: {
      taxYearDefault: Math.round(parsedTaxYear!),
      marginalRateBps: Math.round(parsedRate! * 100),
      defaultWorkPercent: Math.round(parsedWorkPercent!),
      gwgThresholdCents: Math.round(parsedGwgThreshold! * 100),
      applyHalfYearRule: false,
      appLockEnabled: false,
      uploadToOneDriveAfterExport: false,
    },
  };
}

export default function OnboardingProfileSetupRoute() {
  const router = useRouter();
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

  const validation = useMemo(
    () =>
      validateProfileSetupInput(
        taxYearDefault,
        marginalRatePercent,
        defaultWorkPercent,
        gwgThresholdEuros
      ),
    [defaultWorkPercent, gwgThresholdEuros, marginalRatePercent, taxYearDefault]
  );

  const saveProfileSettings = async () => {
    if (!validation.valid || !validation.values || isSaving) {
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
      setSaveError("Could not save profile settings. Please retry.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box flex={1}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          paddingHorizontal: 20,
          paddingVertical: 24,
        }}
      >
        <VStack space="lg">
          <VStack space="xs">
            <Heading size="2xl" textAlign="center">
              Profile Setup
            </Heading>
            <Text size="sm" textAlign="center">
              These defaults are stored locally and can be changed later in Settings.
            </Text>
          </VStack>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <VStack space="xs">
                <Text bold size="sm">
                  Tax year default
                </Text>
                <Input variant="outline">
                  <InputField
                    value={taxYearDefault}
                    onChangeText={setTaxYearDefault}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="2026"
                    testID="onboarding-profile-tax-year-input"
                  />
                </Input>
                {validation.fieldErrors.taxYearDefault ? (
                  <Text size="xs" color="$error600">
                    {validation.fieldErrors.taxYearDefault}
                  </Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Marginal tax rate (%)
                </Text>
                <Input variant="outline">
                  <InputField
                    value={marginalRatePercent}
                    onChangeText={setMarginalRatePercent}
                    keyboardType="decimal-pad"
                    placeholder="40"
                    testID="onboarding-profile-rate-input"
                  />
                </Input>
                {validation.fieldErrors.marginalRatePercent ? (
                  <Text size="xs" color="$error600">
                    {validation.fieldErrors.marginalRatePercent}
                  </Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  Default work percent (%)
                </Text>
                <Input variant="outline">
                  <InputField
                    value={defaultWorkPercent}
                    onChangeText={setDefaultWorkPercent}
                    keyboardType="number-pad"
                    placeholder="100"
                    testID="onboarding-profile-work-percent-input"
                  />
                </Input>
                {validation.fieldErrors.defaultWorkPercent ? (
                  <Text size="xs" color="$error600">
                    {validation.fieldErrors.defaultWorkPercent}
                  </Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text bold size="sm">
                  GWG threshold (EUR)
                </Text>
                <Input variant="outline">
                  <InputField
                    value={gwgThresholdEuros}
                    onChangeText={setGwgThresholdEuros}
                    keyboardType="decimal-pad"
                    placeholder="1000.00"
                    testID="onboarding-profile-gwg-input"
                  />
                </Input>
                {validation.fieldErrors.gwgThresholdEuros ? (
                  <Text size="xs" color="$error600">
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
                  disabled={isSaving || !validation.valid}
                >
                  <ButtonText>Retry Save</ButtonText>
                </Button>
              </VStack>
            </Card>
          ) : null}

          <Button
            onPress={() => void saveProfileSettings()}
            disabled={!validation.valid || isSaving}
            testID="onboarding-profile-save"
          >
            <ButtonText>{isSaving ? "Saving..." : "Save and Continue"}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </Box>
  );
}
