import { Stack } from "expo-router";
import React from "react";

import { useTheme } from "@/hooks/use-theme";

export default function TabSettingsStackLayout() {
  const theme = useTheme();

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
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="appearance" options={{ title: "Appearance" }} />
      <Stack.Screen name="tax-calculation" options={{ title: "Tax & Calculation" }} />
      <Stack.Screen name="security" options={{ title: "Security" }} />
      <Stack.Screen name="backup-sync" options={{ title: "Backup & Sync" }} />
      <Stack.Screen name="legal" options={{ title: "Legal & Privacy" }} />
      <Stack.Screen name="danger-zone" options={{ title: "Danger Zone" }} />
    </Stack>
  );
}
