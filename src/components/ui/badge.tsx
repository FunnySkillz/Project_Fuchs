import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { UiTokens } from "@/components/ui/tokens";
import { useTheme } from "@/hooks/use-theme";

type BadgeVariant = "default" | "success" | "warning" | "danger";

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
}

function getBadgeColors(
  variant: BadgeVariant,
  theme: ReturnType<typeof useTheme>
): {
  backgroundColor: string;
  borderColor: string;
} {
  if (variant === "success") {
    return { backgroundColor: theme.backgroundElement, borderColor: theme.primary };
  }
  if (variant === "warning") {
    return { backgroundColor: theme.backgroundSelected, borderColor: theme.textSecondary };
  }
  if (variant === "danger") {
    return { backgroundColor: theme.backgroundSelected, borderColor: theme.danger };
  }
  return { backgroundColor: theme.backgroundElement, borderColor: theme.border };
}

export function Badge({ text, variant = "default" }: BadgeProps) {
  const theme = useTheme();
  const palette = getBadgeColors(variant, theme);
  return (
    <View style={[styles.base, palette]}>
      <ThemedText type="smallBold">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: UiTokens.radius.xl,
    borderWidth: UiTokens.borderWidth.thin,
    paddingHorizontal: UiTokens.spacing.sm,
    paddingVertical: UiTokens.spacing.xs,
    alignSelf: "flex-start",
  },
});
