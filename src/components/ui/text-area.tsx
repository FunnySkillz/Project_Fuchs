import React from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { UiTokens } from "@/components/ui/tokens";
import { useTheme } from "@/hooks/use-theme";

export function TextArea(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[styles.textArea, { color: theme.text }, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  textArea: {
    minHeight: UiTokens.minHeight.textarea,
    borderWidth: UiTokens.borderWidth.thin,
    borderColor: "#9BA1A6",
    borderRadius: UiTokens.radius.md,
    paddingHorizontal: UiTokens.spacing.md,
    paddingVertical: UiTokens.spacing.sm,
    fontSize: UiTokens.fontSize.md,
    backgroundColor: "#FFFFFF",
  },
});
