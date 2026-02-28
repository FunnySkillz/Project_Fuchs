import React from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { UiTokens } from "@/components/ui/tokens";
import { useTheme } from "@/hooks/use-theme";

export function Input(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[styles.input, { color: theme.text }, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: UiTokens.minHeight.control,
    borderWidth: UiTokens.borderWidth.thin,
    borderColor: "#9BA1A6",
    borderRadius: UiTokens.radius.md,
    paddingHorizontal: UiTokens.spacing.md,
    paddingVertical: UiTokens.spacing.sm,
    fontSize: UiTokens.fontSize.md,
    backgroundColor: "#FFFFFF",
  },
});
