import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

interface Props {
  message: string;
  onRetry: () => void;
  onResetData: () => void;
}

export function InitErrorScreen({ message, onRetry, onResetData }: Props) {
  return (
    <View style={styles.container}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle" style={styles.center}>
          App Initialization Failed
        </ThemedText>
        <ThemedText style={styles.center} themeColor="textSecondary">
          {message}
        </ThemedText>
        <ThemedText style={styles.center} type="small" themeColor="textSecondary">
          Try retrying first. If this keeps failing, you can reset local data to reinitialize the database.
        </ThemedText>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={onRetry}>
          <ThemedText type="smallBold">Retry Initialization</ThemedText>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onResetData}>
          <ThemedText type="smallBold">Reset Local Data</ThemedText>
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
    maxWidth: 640,
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
    borderColor: "#B00020",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#FFF5F5",
  },
  pressed: {
    opacity: 0.75,
  },
});
