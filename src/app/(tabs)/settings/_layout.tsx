import { Stack } from "expo-router";
import React from "react";

import { useI18n } from "@/contexts/language-context";
import { useTheme } from "@/hooks/use-theme";

export default function TabSettingsStackLayout() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.text,
        contentStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("navigation.stack.settingsIndex") }} />
      <Stack.Screen name="appearance" options={{ title: t("navigation.stack.settingsAppearance") }} />
      <Stack.Screen name="language" options={{ title: t("navigation.stack.settingsLanguage") }} />
      <Stack.Screen
        name="tax-calculation"
        options={{ title: t("navigation.stack.settingsTaxCalculation") }}
      />
      <Stack.Screen name="security" options={{ title: t("navigation.stack.settingsSecurity") }} />
      <Stack.Screen name="backup-sync" options={{ title: t("navigation.stack.settingsBackupSync") }} />
      <Stack.Screen name="legal" options={{ title: t("navigation.stack.settingsLegal") }} />
      <Stack.Screen name="danger-zone" options={{ title: t("navigation.stack.settingsDangerZone") }} />
    </Stack>
  );
}
