import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { UiTokens } from "@/components/ui/tokens";
import { useTheme } from "@/hooks/use-theme";

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
  const theme = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          borderColor: theme.border,
          backgroundColor: theme.background,
        },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <ThemedText>{value ?? placeholder}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: UiTokens.minHeight.control,
    borderWidth: UiTokens.borderWidth.thin,
    borderRadius: UiTokens.radius.md,
    justifyContent: "center",
    paddingHorizontal: UiTokens.spacing.md,
    paddingVertical: UiTokens.spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});
