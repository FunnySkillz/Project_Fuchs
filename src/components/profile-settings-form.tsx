import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
      <View style={styles.field}>
        <ThemedText type="smallBold">Tax Year Default</ThemedText>
        <TextInput
          value={taxYearDefault}
          onChangeText={setTaxYearDefault}
          keyboardType="number-pad"
          style={styles.input}
          placeholder="2026"
          maxLength={4}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">Marginal Tax Rate (%)</ThemedText>
        <TextInput
          value={marginalRatePercent}
          onChangeText={setMarginalRatePercent}
          keyboardType="decimal-pad"
          style={styles.input}
          placeholder="40"
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">Default Work-Use Percent (%)</ThemedText>
        <TextInput
          value={defaultWorkPercent}
          onChangeText={setDefaultWorkPercent}
          keyboardType="number-pad"
          style={styles.input}
          placeholder="100"
        />
      </View>

      {showAdvanced && (
        <>
          <View style={styles.separator} />
          <ThemedText type="smallBold">Advanced</ThemedText>
          <View style={styles.field}>
            <ThemedText type="smallBold">GWG Threshold (EUR)</ThemedText>
            <TextInput
              value={gwgThresholdEuros}
              onChangeText={setGwgThresholdEuros}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="1000.00"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
            onPress={() => setApplyHalfYearRule((current) => !current)}>
            <ThemedText type="smallBold">Apply Half-Year Rule</ThemedText>
            <ThemedText>{applyHalfYearRule ? "Enabled" : "Disabled"}</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
            onPress={() => setAppLockEnabled((current) => !current)}>
            <ThemedText type="smallBold">App Lock</ThemedText>
            <ThemedText>{appLockEnabled ? "Enabled" : "Disabled"}</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
            onPress={() => setUploadToOneDriveAfterExport((current) => !current)}>
            <ThemedText type="smallBold">Upload to OneDrive After Export</ThemedText>
            <ThemedText>{uploadToOneDriveAfterExport ? "Enabled" : "Disabled"}</ThemedText>
          </Pressable>
        </>
      )}

      {!validation.valid && <ThemedText style={styles.errorText}>{validation.message}</ThemedText>}
      {saveError && <ThemedText style={styles.errorText}>{saveError}</ThemedText>}

      <Pressable
        style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
        onPress={handleSubmit}
        disabled={!validation.valid || isSaving}>
        <ThemedText type="smallBold">{isSaving ? "Saving..." : submitLabel}</ThemedText>
      </Pressable>

      {onResetToDefault && (
        <Pressable
          style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          onPress={() => void onResetToDefault()}>
          <ThemedText type="smallBold">Reset to Defaults</ThemedText>
        </Pressable>
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
  input: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  separator: {
    height: 1,
    backgroundColor: "#D6D8DB",
    marginVertical: Spacing.one,
  },
  toggleRow: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  submitButton: {
    marginTop: Spacing.one,
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#ECEDEE",
  },
  pressed: {
    opacity: 0.75,
  },
  errorText: {
    color: "#B00020",
  },
  resetButton: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
});
