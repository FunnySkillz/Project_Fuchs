import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { UiTokens } from "@/components/ui/tokens";

interface DatePickerTriggerProps {
  value: string | null;
  onPress: () => void;
  placeholder?: string;
}

export function DatePickerTrigger({
  value,
  onPress,
  placeholder = "Select date",
}: DatePickerTriggerProps) {
  return (
    <Pressable style={({ pressed }) => [styles.base, pressed && styles.pressed]} onPress={onPress}>
      <ThemedText>{value ?? placeholder}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: UiTokens.minHeight.control,
    borderWidth: UiTokens.borderWidth.thin,
    borderColor: "#9BA1A6",
    borderRadius: UiTokens.radius.md,
    justifyContent: "center",
    paddingHorizontal: UiTokens.spacing.md,
    paddingVertical: UiTokens.spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  pressed: {
    opacity: 0.75,
  },
});
