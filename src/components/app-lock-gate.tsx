import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ButtonText } from "@gluestack-ui/themed";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useI18n } from "@/contexts/language-context";
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
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle" style={styles.center}>
            {t("appLock.title")}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {t("appLock.subtitle")}
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
                placeholder={t("appLock.pinPlaceholder")}
                placeholderTextColor={theme.textSecondary}
                testID="app-lock-pin-input"
              />
              {errorMessage && (
                <ThemedText testID="app-lock-error" style={[styles.errorText, { color: theme.danger }]}>
                  {errorMessage}
                </ThemedText>
              )}
              <Button
                onPress={onPinSubmit}
                isDisabled={isAuthenticating}
                testID="app-lock-unlock"
                style={[
                  styles.primaryButton,
                  {
                    borderColor: theme.primary,
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <ButtonText color={theme.textOnPrimary}>{t("appLock.unlock")}</ButtonText>
              </Button>
            </>
          )}

          {!pinEnabled && errorMessage && (
            <ThemedText testID="app-lock-error" style={[styles.errorText, { color: theme.danger }]}>
              {errorMessage}
            </ThemedText>
          )}

          {pinEnabled && (
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: theme.border }]} />
              <ThemedText type="small" themeColor="textSecondary">
                {t("appLock.or")}
              </ThemedText>
              <View style={[styles.orLine, { backgroundColor: theme.border }]} />
            </View>
          )}

          <View style={styles.secondaryActions}>
            <Button
              variant="outline"
              action="secondary"
              style={[
                styles.secondaryActionButton,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
              onPress={onUseBiometric}
              isDisabled={isAuthenticating}
              testID="app-lock-use-face-id"
            >
              <ButtonText color={theme.text}>
                {isAuthenticating ? t("appLock.authenticating") : t("appLock.useBiometric")}
              </ButtonText>
            </Button>
            <Button
              variant="link"
              action="secondary"
              style={styles.tertiaryActionButton}
              onPress={onCancel}
              testID="app-lock-cancel"
            >
              <ButtonText color={theme.textSecondary}>{t("appLock.cancel")}</ButtonText>
            </Button>
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
    borderRadius: 12,
    width: "100%",
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  secondaryActions: {
    gap: Spacing.two,
  },
  secondaryActionButton: {
    width: "100%",
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tertiaryActionButton: {
    width: "100%",
    minHeight: 44,
    borderWidth: 0,
    justifyContent: "center",
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
});
