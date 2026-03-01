import React, { useCallback, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export function TextArea(props: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const handleFocus = useCallback(
    (event: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
      setFocused(true);
      props.onFocus?.(event);
    },
    [props]
  );
  const handleBlur = useCallback(
    (event: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => {
      setFocused(false);
      props.onBlur?.(event);
    },
    [props]
  );

  return (
    <TextInput
      {...props}
      multiline
      textAlignVertical="top"
      placeholderTextColor={theme.textSecondary}
      selectionColor={theme.primary}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[
        {
          color: theme.text,
          borderColor: focused ? theme.primary : theme.border,
        },
        props.style,
      ]}
      className="min-h-textarea rounded-ui-md border border-ui-border bg-ui-surface px-ui-md py-ui-sm text-base"
    />
  );
}
