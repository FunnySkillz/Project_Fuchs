import { Stack } from "expo-router";
import React from "react";
import { HeaderBackButton } from "@react-navigation/elements";

import { useTheme } from "@/hooks/use-theme";

export default function ItemStackLayout() {
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
        headerBackButtonDisplayMode: "minimal",
        presentation: "card",
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="new"
        options={{
          title: "Add Item",
          headerLeft: (props) =>
            props.canGoBack ? <HeaderBackButton {...props} testID="additem-header-back" /> : null,
        }}
      />
      <Stack.Screen
        name="[id]/index"
        options={{
          title: "Item Detail",
        }}
      />
      <Stack.Screen
        name="[id]/edit"
        options={{
          title: "Edit Item",
          headerLeft: (props) =>
            props.canGoBack ? <HeaderBackButton {...props} testID="edititem-header-back" /> : null,
          presentation: "card",
        }}
      />
    </Stack>
  );
}
