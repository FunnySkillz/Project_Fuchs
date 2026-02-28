import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button, FormField, Input } from "@/components/ui";
import {
  bpsToPercent,
  type ProfileSettings,
  percentToBps,
} from "@/models/profile-settings";
import { Spacing } from "@/constants/theme";

export interface ProfileSettingsFormValues {
  taxYearDefault: number;
  marginalRateBps: number;
  defaultWorkPercent: number;
  gwgThresholdCents: number;
  applyHalfYearRule: boolean;
  appLockEnabled: boolean;
  uploadToOneDriveAfterExport: boolean;
}

interface Props {
  initialValues: ProfileSettings;
  submitLabel: string;
  showAdvanced?: boolean;
  onResetToDefault?: () => Promise<void>;
  onValuesChange?: (values: ProfileSettingsFormValues | null) => void;
  onSubmit: (values: ProfileSettingsFormValues) => Promise<void>;
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

export function ProfileSettingsForm({
  initialValues,
  submitLabel,
  showAdvanced = false,
  onResetToDefault,
  onValuesChange,
  onSubmit,
}: Props) {
  const [taxYearDefault, setTaxYearDefault] = useState(String(initialValues.taxYearDefault));
  const [marginalRatePercent, setMarginalRatePercent] = useState(
    String(bpsToPercent(initialValues.marginalRateBps))
  );
  const [defaultWorkPercent, setDefaultWorkPercent] = useState(String(initialValues.defaultWorkPercent));
  const [gwgThresholdEuros, setGwgThresholdEuros] = useState(
    String((initialValues.gwgThresholdCents / 100).toFixed(2))
  );
  const [applyHalfYearRule, setApplyHalfYearRule] = useState(initialValues.applyHalfYearRule);
  const [appLockEnabled, setAppLockEnabled] = useState(initialValues.appLockEnabled);
  const [uploadToOneDriveAfterExport, setUploadToOneDriveAfterExport] = useState(
    initialValues.uploadToOneDriveAfterExport
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  React.useEffect(() => {
    setTaxYearDefault(String(initialValues.taxYearDefault));
    setMarginalRatePercent(String(bpsToPercent(initialValues.marginalRateBps)));
    setDefaultWorkPercent(String(initialValues.defaultWorkPercent));
    setGwgThresholdEuros(String((initialValues.gwgThresholdCents / 100).toFixed(2)));
    setApplyHalfYearRule(initialValues.applyHalfYearRule);
    setAppLockEnabled(initialValues.appLockEnabled);
    setUploadToOneDriveAfterExport(initialValues.uploadToOneDriveAfterExport);
  }, [initialValues]);

  const validation = useMemo(() => {
    const parsedTaxYear = parseNumber(taxYearDefault);
    const parsedRate = parseNumber(marginalRatePercent);
    const parsedWorkPercent = parseNumber(defaultWorkPercent);
    const parsedGwgThresholdEuros = parseNumber(gwgThresholdEuros);

    if (parsedTaxYear === null || !Number.isInteger(parsedTaxYear)) {
      return { valid: false, message: "Tax year must be a whole number." } as const;
    }

    if (parsedTaxYear < 2000 || parsedTaxYear > 2100) {
      return { valid: false, message: "Tax year must be between 2000 and 2100." } as const;
    }

    if (parsedRate === null) {
      return { valid: false, message: "Marginal tax rate is required." } as const;
    }

    if (parsedRate < 0 || parsedRate > 55) {
      return { valid: false, message: "Marginal tax rate must be between 0 and 55%." } as const;
    }

    if (parsedWorkPercent === null) {
      return { valid: false, message: "Default work-use percent is required." } as const;
    }

    if (parsedWorkPercent < 0 || parsedWorkPercent > 100) {
      return { valid: false, message: "Default work-use percent must be between 0 and 100%." } as const;
    }

    if (parsedGwgThresholdEuros === null) {
      return { valid: false, message: "GWG threshold is required." } as const;
    }

    if (parsedGwgThresholdEuros < 0) {
      return { valid: false, message: "GWG threshold must be 0 or higher." } as const;
    }

    return {
      valid: true,
      values: {
        taxYearDefault: Math.round(parsedTaxYear),
        marginalRateBps: percentToBps(parsedRate),
        defaultWorkPercent: Math.round(parsedWorkPercent),
        gwgThresholdCents: Math.round(parsedGwgThresholdEuros * 100),
        applyHalfYearRule,
        appLockEnabled,
        uploadToOneDriveAfterExport,
      },
    } as const;
  }, [
    appLockEnabled,
    applyHalfYearRule,
    defaultWorkPercent,
    gwgThresholdEuros,
    marginalRatePercent,
    taxYearDefault,
    uploadToOneDriveAfterExport,
  ]);

  React.useEffect(() => {
    onValuesChange?.(validation.valid ? validation.values : null);
  }, [onValuesChange, validation]);

  const handleSubmit = async () => {
    if (!validation.valid || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      await onSubmit(validation.values);
    } catch (error) {
      console.error("Failed to persist profile settings", error);
      setSaveError("Could not save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView type="backgroundElement" style={styles.formCard}>
      <FormField label="Tax Year Default">
        <Input
          value={taxYearDefault}
          onChangeText={setTaxYearDefault}
          keyboardType="number-pad"
          placeholder="2026"
          maxLength={4}
        />
      </FormField>

      <FormField label="Marginal Tax Rate (%)">
        <Input
          value={marginalRatePercent}
          onChangeText={setMarginalRatePercent}
          keyboardType="decimal-pad"
          placeholder="40"
        />
      </FormField>

      <FormField label="Default Work-Use Percent (%)">
        <Input
          value={defaultWorkPercent}
          onChangeText={setDefaultWorkPercent}
          keyboardType="number-pad"
          placeholder="100"
        />
      </FormField>

      {showAdvanced && (
        <>
          <View style={styles.separator} />
          <ThemedText type="smallBold">Advanced</ThemedText>
          <FormField label="GWG Threshold (EUR)">
            <Input
              value={gwgThresholdEuros}
              onChangeText={setGwgThresholdEuros}
              keyboardType="decimal-pad"
              placeholder="1000.00"
            />
          </FormField>

          <Button
            variant="secondary"
            style={styles.toggleRow}
            onPress={() => setApplyHalfYearRule((current) => !current)}
            label={`Apply Half-Year Rule: ${applyHalfYearRule ? "Enabled" : "Disabled"}`}
          />

          <Button
            variant="secondary"
            style={styles.toggleRow}
            onPress={() => setAppLockEnabled((current) => !current)}
            label={`App Lock: ${appLockEnabled ? "Enabled" : "Disabled"}`}
          />

          <Button
            variant="secondary"
            style={styles.toggleRow}
            onPress={() => setUploadToOneDriveAfterExport((current) => !current)}
            label={`Upload to OneDrive After Export: ${
              uploadToOneDriveAfterExport ? "Enabled" : "Disabled"
            }`}
          />
        </>
      )}

      {!validation.valid && <ThemedText style={styles.errorText}>{validation.message}</ThemedText>}
      {saveError && <ThemedText style={styles.errorText}>{saveError}</ThemedText>}

      <Button
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={!validation.valid || isSaving}
        label={isSaving ? "Saving..." : submitLabel}
      />

      {onResetToDefault && (
        <Button variant="ghost" style={styles.resetButton} onPress={() => void onResetToDefault()} label="Reset to Defaults" />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  separator: {
    height: 1,
    backgroundColor: "#D6D8DB",
    marginVertical: Spacing.one,
  },
  toggleRow: {
    marginTop: 0,
  },
  submitButton: {
    marginTop: Spacing.one,
  },
  errorText: {
    color: "#B00020",
  },
  resetButton: {
    marginTop: 0,
  },
});
