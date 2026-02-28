import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { UiTokens } from "@/components/ui/tokens";
import { useTheme } from "@/hooks/use-theme";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  onChange: (nextValue: string) => void;
}

export function Select({ value, options, placeholder = "Select...", onChange }: SelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? placeholder,
    [options, placeholder, value]
  );

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: "#FFFFFF" },
          pressed && styles.pressed,
        ]}
        onPress={() => setOpen(true)}>
        <ThemedText>{selectedLabel}</ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.background }]}>
            <ScrollView contentContainerStyle={styles.optionsContainer}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && styles.pressed,
                    option.value === value && { borderColor: theme.text },
                  ]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}>
                  <ThemedText>{option.label}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: UiTokens.minHeight.control,
    borderWidth: UiTokens.borderWidth.thin,
    borderColor: "#9BA1A6",
    borderRadius: UiTokens.radius.md,
    justifyContent: "center",
    paddingHorizontal: UiTokens.spacing.md,
    paddingVertical: UiTokens.spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: UiTokens.spacing.md,
  },
  sheet: {
    borderRadius: UiTokens.radius.lg,
    borderWidth: UiTokens.borderWidth.thin,
    borderColor: "#9BA1A6",
    maxHeight: "70%",
  },
  optionsContainer: {
    padding: UiTokens.spacing.sm,
    gap: UiTokens.spacing.xs,
  },
  optionRow: {
    borderWidth: UiTokens.borderWidth.thin,
    borderColor: "#D6D8DB",
    borderRadius: UiTokens.radius.md,
    paddingHorizontal: UiTokens.spacing.md,
    paddingVertical: UiTokens.spacing.sm,
  },
  closeButton: {
    borderTopWidth: UiTokens.borderWidth.thin,
    borderColor: "#D6D8DB",
    alignItems: "center",
    paddingVertical: UiTokens.spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});
