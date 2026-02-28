import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

interface Props {
  isAuthenticating: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

export function AppLockGate({ isAuthenticating, errorMessage, onRetry, onCancel }: Props) {
  return (
    <View style={styles.container}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle" style={styles.center}>
          App Locked
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Authenticate with biometrics or your device passcode to continue.
        </ThemedText>
        {errorMessage && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={onRetry}
          disabled={isAuthenticating}>
          <ThemedText type="smallBold">
            {isAuthenticating ? "Authenticating..." : "Retry Authentication"}
          </ThemedText>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onCancel}>
          <ThemedText type="smallBold">Cancel</ThemedText>
        </Pressable>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: {
    textAlign: "center",
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#ECEDEE",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  errorText: {
    color: "#B00020",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.75,
  },
});
