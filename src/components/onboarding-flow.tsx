import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ProfileSettingsForm, type ProfileSettingsFormValues } from "@/components/profile-settings-form";
import { Spacing } from "@/constants/theme";
import { createDefaultProfileSettings, type ProfileSettings } from "@/models/profile-settings";

interface Props {
  initialSettings?: ProfileSettings;
  onComplete: (values: ProfileSettingsFormValues) => Promise<void>;
}

export function OnboardingFlow({ initialSettings, onComplete }: Props) {
  const [step, setStep] = useState<"welcome" | "profile">("welcome");
  const defaults = useMemo(
    () => initialSettings ?? createDefaultProfileSettings(),
    [initialSettings]
  );

  if (step === "profile") {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
        <View style={styles.inner}>
          <ThemedText type="title" style={styles.center}>
            Profile Setup
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            These values are stored locally on your device and can be changed later in Settings.
          </ThemedText>
          <ProfileSettingsForm initialValues={defaults} submitLabel="Save and Continue" onSubmit={onComplete} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
      <View style={styles.inner}>
        <ThemedText type="title" style={styles.center}>
          Welcome to SteuerFuchs
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Disclaimer</ThemedText>
          <ThemedText type="small">
            This app helps with structured tax preparation. It is not legal tax advice.
          </ThemedText>
          <ThemedText type="small">
            Data stays on your device by default. No account login is required for V1.
          </ThemedText>
        </ThemedView>

        <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => setStep("profile")}>
          <ThemedText type="smallBold">Continue to Profile Setup</ThemedText>
        </Pressable>
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
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  button: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#ECEDEE",
  },
  pressed: {
    opacity: 0.75,
  },
});
