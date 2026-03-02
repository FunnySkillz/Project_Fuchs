import { Stack } from "expo-router";
import React from "react";

export default function ItemStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/edit" />
    </Stack>
  );
}
