import React from "react";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

export default function ItemsRoute() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Items</ThemedText>
      <ThemedText themeColor="textSecondary">Placeholder screen for item listing and filters.</ThemedText>
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
