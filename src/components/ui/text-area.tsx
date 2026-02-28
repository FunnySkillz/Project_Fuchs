import React from "react";
import { TextInput, type TextInputProps } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export function TextArea(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[{ color: theme.text }, props.style]}
      className="min-h-textarea rounded-ui-md border border-ui-border bg-ui-surface px-ui-md py-ui-sm text-base"
    />
  );
}
