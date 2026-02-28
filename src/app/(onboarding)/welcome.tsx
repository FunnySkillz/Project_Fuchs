import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

export default function OnboardingWelcomeRoute() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.inner}>
        <ThemedText type="title" style={styles.center}>
          Welcome to SteuerFuchs
        </ThemedText>
        <Card>
          <ThemedText type="smallBold">Disclaimer</ThemedText>
          <ThemedText type="small">
            This app helps with structured tax preparation. It is not legal tax advice.
          </ThemedText>
          <ThemedText type="small">
            Data stays local by default. No account login is required for V1.
          </ThemedText>
        </Card>
        <Button
          label="Continue to Profile Setup"
          onPress={() => router.push("/(onboarding)/profile-setup")}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.four,
  },
  inner: {
    width: "100%",
    maxWidth: 720,
    gap: Spacing.three,
    alignSelf: "center",
  },
  center: {
    textAlign: "center",
  },
});
