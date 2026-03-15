import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { useI18n } from "@/contexts/language-context";
import { ThemedText } from "@/components/themed-text";
import { UiTokens } from "@/components/ui/tokens";
import { useTheme } from "@/hooks/use-theme";

interface DatePickerTriggerProps {
  value: string | null;
  onPress: () => void;
  placeholder?: string;
}

export function DatePickerTrigger({
  value,
  onPress,
  placeholder,
}: DatePickerTriggerProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("common.date.selectDate");

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          borderColor: theme.border,
          backgroundColor: theme.background,
        },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <ThemedText>{value ?? resolvedPlaceholder}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: UiTokens.minHeight.control,
    borderWidth: UiTokens.borderWidth.thin,
    borderRadius: UiTokens.radius.md,
    justifyContent: "center",
    paddingHorizontal: UiTokens.spacing.md,
    paddingVertical: UiTokens.spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});
