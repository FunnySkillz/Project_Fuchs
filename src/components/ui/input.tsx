import React from "react";
import { TextInput, type TextInputProps } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export function Input(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[{ color: theme.text }, props.style]}
      className="min-h-control rounded-ui-md border border-ui-border bg-ui-surface px-ui-md py-ui-sm text-base"
    />
  );
}
