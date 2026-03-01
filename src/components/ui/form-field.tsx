import React from "react";
import { View, type ViewProps } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

interface FormFieldProps extends ViewProps {
  label: string;
  error?: string | null;
  hint?: string | null;
}

export function FormField({ label, error, hint, children, style, ...props }: FormFieldProps) {
  const theme = useTheme();

  return (
    <View {...props} style={style} className="gap-ui-xs">
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      {error ? <ThemedText style={{ color: theme.danger }}>{error}</ThemedText> : null}
      {!error && hint ? <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText> : null}
    </View>
  );
}
