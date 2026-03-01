import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  onChange: (nextValue: string) => void;
}

export function Select({
  value,
  options,
  placeholder = "Select...",
  searchable = true,
  onChange,
}: SelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? placeholder,
    [options, placeholder, value]
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          setQuery("");
        }}
        accessibilityRole="button"
        style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
        className="min-h-control rounded-ui-md border border-ui-border bg-ui-surface px-ui-md py-ui-sm justify-center">
        <ThemedText>{selectedLabel}</ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-ui-overlay justify-center p-ui-md">
          <View className="rounded-ui-lg border border-ui-border bg-ui-surface max-h-[70%]">
            {searchable ? (
              <View className="p-ui-sm border-b border-ui-borderSoft">
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search..."
                  placeholderTextColor={theme.textSecondary}
                  className="min-h-control rounded-ui-md border border-ui-border bg-ui-surface px-ui-md py-ui-sm text-base"
                  style={{ color: theme.text }}
                />
              </View>
            ) : null}

            <ScrollView contentContainerClassName="p-ui-sm gap-ui-xs">
              {filteredOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => (pressed ? { opacity: 0.75 } : null)}
                  className={`min-h-control rounded-ui-md border px-ui-md py-ui-sm justify-center ${
                    option.value === value
                      ? "border-ui-primary bg-ui-card"
                      : "border-ui-borderSoft bg-ui-surface"
                  }`}>
                  <ThemedText>{option.label}</ThemedText>
                </Pressable>
              ))}
              {filteredOptions.length === 0 ? (
                <View className="min-h-control rounded-ui-md border border-ui-borderSoft px-ui-md py-ui-sm justify-center">
                  <ThemedText type="small" themeColor="textSecondary">
                    No results.
                  </ThemedText>
                </View>
              ) : null}
            </ScrollView>

            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              style={({ pressed }) => (pressed ? { opacity: 0.75 } : null)}
              className="min-h-control border-t border-ui-borderSoft items-center justify-center">
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
