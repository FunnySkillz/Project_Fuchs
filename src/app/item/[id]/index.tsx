import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

export default function ItemDetailRoute() {
  const params = useLocalSearchParams<{ id?: string }>();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Item Detail</ThemedText>
      <ThemedText themeColor="textSecondary">
        Placeholder screen for item id: {params.id ?? "unknown"}.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
