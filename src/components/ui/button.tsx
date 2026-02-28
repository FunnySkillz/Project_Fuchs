import React from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
}

function resolveVariantClassName(variant: ButtonVariant): string {
  if (variant === "secondary") {
    return "bg-ui-card border-ui-border";
  }
  if (variant === "danger") {
    return "bg-ui-dangerBg border-ui-danger";
  }
  if (variant === "ghost") {
    return "bg-transparent border-ui-border";
  }
  return "bg-ui-primary border-ui-border";
}

export function Button({ label, onPress, disabled = false, variant = "primary", style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        style,
        pressed && !disabled ? { opacity: 0.78 } : null,
        disabled ? { opacity: 0.5 } : null,
      ]}
      className={`min-h-control rounded-ui-md border px-ui-md py-ui-sm items-center justify-center ${resolveVariantClassName(variant)}`}>
      <ThemedText
        type="smallBold"
        style={[
          variant === "primary" ? { color: "#FFFFFF" } : null,
          variant === "danger" ? { color: "#B00020" } : null,
        ]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
