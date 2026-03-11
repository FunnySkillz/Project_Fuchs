import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface Props {
  isAuthenticating: boolean;
  errorMessage: string | null;
  pinEnabled: boolean;
  pinValue: string;
  onPinValueChange: (value: string) => void;
  onPinSubmit: () => void;
  onUseBiometric: () => void;
  onCancel: () => void;
}

export function AppLockGate({
  isAuthenticating,
  errorMessage,
  pinEnabled,
  pinValue,
  onPinValueChange,
  onPinSubmit,
  onUseBiometric,
  onCancel,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle" style={styles.center}>
            App Locked
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Authenticate with biometrics or enter your PIN.
          </ThemedText>

          {pinEnabled && (
            <>
              <TextInput
                value={pinValue}
                onChangeText={onPinValueChange}
                style={[
                  styles.pinInput,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.background,
                    color: theme.text,
                  },
                ]}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Enter PIN"
                placeholderTextColor={theme.textSecondary}
                testID="app-lock-pin-input"
              />
              {errorMessage && (
                <ThemedText testID="app-lock-error" style={[styles.errorText, { color: theme.danger }]}>
                  {errorMessage}
                </ThemedText>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    borderColor: theme.primary,
                    backgroundColor: theme.primary,
                  },
                  (pressed || isAuthenticating) && styles.pressed,
                ]}
                onPress={onPinSubmit}
                disabled={isAuthenticating}
                testID="app-lock-unlock"
              >
                <ThemedText type="smallBold" themeColor="textOnPrimary">
                  Unlock
                </ThemedText>
              </Pressable>
            </>
          )}

          {!pinEnabled && errorMessage && (
            <ThemedText testID="app-lock-error" style={[styles.errorText, { color: theme.danger }]}>
              {errorMessage}
            </ThemedText>
          )}

          <View style={styles.secondaryActions}>
            <Pressable
              style={({ pressed }) => [styles.secondaryActionButton, (pressed || isAuthenticating) && styles.pressed]}
              onPress={onUseBiometric}
              disabled={isAuthenticating}
              testID="app-lock-use-face-id"
            >
              <ThemedText type="smallBold" themeColor="primary">
                {isAuthenticating ? "Authenticating..." : "Use Face ID"}
              </ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryActionButton, pressed && styles.pressed]}
              onPress={onCancel}
              testID="app-lock-cancel"
            >
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: {
    textAlign: "center",
  },
  primaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryActions: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  secondaryActionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  errorText: {
    textAlign: "left",
  },
  pinInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.75,
  },
});
