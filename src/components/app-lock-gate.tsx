import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

interface Props {
  isAuthenticating: boolean;
  errorMessage: string | null;
  pinEnabled: boolean;
  pinValue: string;
  onPinValueChange: (value: string) => void;
  onPinSubmit: () => void;
  onUsePin: () => void;
  onUseBiometric: () => void;
  showPinEntry: boolean;
  onRetry: () => void;
  onCancel: () => void;
}

export function AppLockGate({
  isAuthenticating,
  errorMessage,
  pinEnabled,
  pinValue,
  onPinValueChange,
  onPinSubmit,
  onUsePin,
  onUseBiometric,
  showPinEntry,
  onRetry,
  onCancel,
}: Props) {
  return (
    <View style={styles.container}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle" style={styles.center}>
          App Locked
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Authenticate with biometrics or your device passcode to continue.
        </ThemedText>
        {errorMessage && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}
        {pinEnabled && showPinEntry && (
          <>
            <TextInput
              value={pinValue}
              onChangeText={onPinValueChange}
              style={styles.pinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="Enter PIN"
            />
            <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={onPinSubmit}>
              <ThemedText type="smallBold">Unlock with PIN</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={onUseBiometric}>
              <ThemedText type="smallBold">Use Biometrics Instead</ThemedText>
            </Pressable>
          </>
        )}
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={onRetry}
          disabled={isAuthenticating}>
          <ThemedText type="smallBold">
            {isAuthenticating ? "Authenticating..." : "Retry Authentication"}
          </ThemedText>
        </Pressable>
        {pinEnabled && !showPinEntry && (
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onUsePin}>
            <ThemedText type="smallBold">Use PIN Instead</ThemedText>
          </Pressable>
        )}
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onCancel}>
          <ThemedText type="smallBold">Cancel</ThemedText>
        </Pressable>
      </ThemedView>
    </View>
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
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#ECEDEE",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  errorText: {
    color: "#B00020",
    textAlign: "center",
  },
  pinInput: {
    borderWidth: 1,
    borderColor: "#9BA1A6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  pressed: {
    opacity: 0.75,
  },
});
