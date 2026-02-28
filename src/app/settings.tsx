import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ProfileSettingsForm, type ProfileSettingsFormValues } from "@/components/profile-settings-form";
import { ThemedText } from "@/components/themed-text";
import { createDefaultProfileSettings, type ProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { Spacing } from "@/constants/theme";

export default function SettingsScreen() {
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  if (!settings) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText>Loading settings...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="title">Settings</ThemedText>
      <ThemedText themeColor="textSecondary">
        Update your local profile defaults. These values affect future calculations.
      </ThemedText>
      {loadError && <ThemedText style={styles.errorText}>{loadError}</ThemedText>}
      <ProfileSettingsForm initialValues={settings} submitLabel="Save Settings" onSubmit={handleSubmit} />
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
});
