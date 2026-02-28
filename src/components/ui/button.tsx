import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { UiTokens } from "@/components/ui/tokens";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: ViewStyle;
}

function resolveVariantStyle(variant: ButtonVariant, theme: ReturnType<typeof useTheme>): ViewStyle {
  if (variant === "secondary") {
    return {
      backgroundColor: theme.backgroundElement,
      borderColor: "#9BA1A6",
    };
  }
  if (variant === "danger") {
    return {
      backgroundColor: "#FFDCDC",
      borderColor: "#B00020",
    };
  }
  if (variant === "ghost") {
    return {
      backgroundColor: "transparent",
      borderColor: "#9BA1A6",
    };
  }

  return {
    backgroundColor: theme.backgroundSelected,
    borderColor: "#9BA1A6",
  };
}

export function Button({ label, onPress, disabled = false, variant = "primary", style }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        resolveVariantStyle(variant, theme),
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: UiTokens.minHeight.control,
    borderRadius: UiTokens.radius.md,
    borderWidth: UiTokens.borderWidth.thin,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: UiTokens.spacing.md,
    paddingVertical: UiTokens.spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
