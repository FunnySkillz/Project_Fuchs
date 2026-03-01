import { Stack } from "expo-router";
import React from "react";

import { useTheme } from "@/hooks/use-theme";

export default function SettingsStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
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
      <Stack.Screen name="settings-appearance" options={{ title: "Appearance" }} />
      <Stack.Screen name="settings-tax-calculation" options={{ title: "Tax & Calculation" }} />
      <Stack.Screen name="settings-security" options={{ title: "Security" }} />
      <Stack.Screen name="settings-backup-sync" options={{ title: "Backup & Sync" }} />
      <Stack.Screen name="settings-danger-zone" options={{ title: "Danger Zone" }} />
    </Stack>
  );
}
