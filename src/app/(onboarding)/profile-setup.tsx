import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ProfileSettingsForm, type ProfileSettingsFormValues } from "@/components/profile-settings-form";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { createDefaultProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { emitProfileSettingsSaved } from "@/services/app-events";

export default function OnboardingProfileSetupRoute() {
  const router = useRouter();
  const defaults = useMemo(() => createDefaultProfileSettings(), []);

  const handleComplete = async (values: ProfileSettingsFormValues) => {
    const repository = await getProfileSettingsRepository();
    await repository.upsertSettings(values);
    emitProfileSettingsSaved();
    router.replace("/(tabs)/home");
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
      <View style={styles.inner}>
        <ThemedText type="title" style={styles.center}>
          Profile Setup
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          These values are stored locally and can be changed later in Settings.
        </ThemedText>
        <ProfileSettingsForm
          initialValues={defaults}
          submitLabel="Save and Continue"
          onSubmit={handleComplete}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.four,
  },
  inner: {
    gap: Spacing.three,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  center: {
    textAlign: "center",
  },
});
