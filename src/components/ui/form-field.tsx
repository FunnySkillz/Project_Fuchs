import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { UiTokens } from "@/components/ui/tokens";

interface FormFieldProps extends ViewProps {
  label: string;
  error?: string | null;
  hint?: string | null;
}

export function FormField({ label, error, hint, children, style, ...props }: FormFieldProps) {
  return (
    <View {...props} style={[styles.base, style]}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      {!error && hint ? <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: UiTokens.spacing.xs,
  },
  error: {
    color: "#B00020",
  },
});
