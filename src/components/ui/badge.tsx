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

function getBadgeColors(variant: BadgeVariant, backgroundElement: string): {
  backgroundColor: string;
  borderColor: string;
} {
  if (variant === "success") {
    return { backgroundColor: "#E6F5EA", borderColor: "#0B7D47" };
  }
  if (variant === "warning") {
    return { backgroundColor: "#FFF4E0", borderColor: "#A66A00" };
  }
  if (variant === "danger") {
    return { backgroundColor: "#FFE8E8", borderColor: "#B00020" };
  }
  return { backgroundColor: backgroundElement, borderColor: "#9BA1A6" };
}

export function Badge({ text, variant = "default" }: BadgeProps) {
  const theme = useTheme();
  const palette = getBadgeColors(variant, theme.backgroundElement);
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
