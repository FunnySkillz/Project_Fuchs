import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ProfileSettingsForm, type ProfileSettingsFormValues } from "@/components/profile-settings-form";
import { ThemedText } from "@/components/themed-text";
import { createDefaultProfileSettings, type ProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { Spacing } from "@/constants/theme";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function calculatePreview(values: ProfileSettingsFormValues) {
  const sampleItemCents = 150_000;
  const workShare = values.defaultWorkPercent / 100;
  const workRelevantCents = Math.round(sampleItemCents * workShare);
  const immediate = workRelevantCents <= values.gwgThresholdCents;
  const deductibleThisYearCents = immediate
    ? workRelevantCents
    : Math.round((workRelevantCents / 36) * (values.applyHalfYearRule ? 6 : 12));
  const estimatedRefundCents = Math.round((deductibleThisYearCents * values.marginalRateBps) / 10_000);

  return {
    sampleItemCents,
    workRelevantCents,
    deductibleThisYearCents,
    estimatedRefundCents,
    immediate,
  };
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<ProfileSettingsFormValues | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const repository = await getProfileSettingsRepository();
        const loaded = await repository.getSettings();
        if (isMounted) {
          setSettings(loaded);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load settings", error);
          setLoadError("Could not load settings.");
          setSettings(createDefaultProfileSettings());
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (values: ProfileSettingsFormValues) => {
    const repository = await getProfileSettingsRepository();
    const updated = await repository.upsertSettings(values);
    setSettings(updated);
  };

  const handleReset = async () => {
    const repository = await getProfileSettingsRepository();
    const defaults = createDefaultProfileSettings();
    const updated = await repository.upsertSettings(defaults);
    setSettings(updated);
    setDraftValues({
      taxYearDefault: updated.taxYearDefault,
      marginalRateBps: updated.marginalRateBps,
      defaultWorkPercent: updated.defaultWorkPercent,
      gwgThresholdCents: updated.gwgThresholdCents,
      applyHalfYearRule: updated.applyHalfYearRule,
    });
  };

  if (!settings) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText>Loading settings...</ThemedText>
      </View>
    );
  }

  const preview = draftValues ? calculatePreview(draftValues) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="title">Settings</ThemedText>
      <ThemedText themeColor="textSecondary">
        Update your local profile defaults. These values affect future calculations.
      </ThemedText>
      {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}
      <ProfileSettingsForm
        initialValues={settings}
        submitLabel="Save Settings"
        showAdvanced
        onSubmit={handleSubmit}
        onResetToDefault={handleReset}
        onValuesChange={setDraftValues}
      />
      {preview && (
        <View style={styles.previewCard}>
          <ThemedText type="smallBold">Calculation Preview (sample item)</ThemedText>
          <ThemedText type="small">Sample item price: {formatCents(preview.sampleItemCents)}</ThemedText>
          <ThemedText type="small">
            Work-relevant amount: {formatCents(preview.workRelevantCents)}
          </ThemedText>
          <ThemedText type="small">
            Deductible this year: {formatCents(preview.deductibleThisYearCents)}
          </ThemedText>
          <ThemedText type="small">
            Estimated refund: {formatCents(preview.estimatedRefundCents)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Mode: {preview.immediate ? "Immediate deduction (below GWG)" : "AfA schedule (above GWG)"}
          </ThemedText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#B00020",
  },
  previewCard: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.one,
    backgroundColor: "#FFFFFF",
  },
});
