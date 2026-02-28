import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { UiTokens } from "@/components/ui/tokens";
import { useTheme } from "@/hooks/use-theme";

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      {...props}
      style={[
        styles.base,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: UiTokens.radius.lg,
    borderWidth: UiTokens.borderWidth.thin,
    padding: UiTokens.spacing.md,
    gap: UiTokens.spacing.sm,
  },
});
