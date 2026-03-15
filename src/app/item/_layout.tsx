import { Stack, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { HeaderBackButton } from "@react-navigation/elements";

import { useI18n } from "@/contexts/language-context";
import { useTheme } from "@/hooks/use-theme";

export default function ItemStackLayout() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useI18n();
  const goBackToItemsFallback = useCallback(() => {
    const routerWithBack = router as {
      canGoBack?: () => boolean;
      back?: () => void;
    };
    if (typeof routerWithBack.canGoBack === "function" && routerWithBack.canGoBack()) {
      routerWithBack.back?.();
      return;
    }
    router.replace("/(tabs)/items");
  }, [router]);

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
          title: t("navigation.stack.itemNew"),
          headerLeft: (props) =>
            props.canGoBack ? (
              <HeaderBackButton
                {...props}
                testID="additem-header-back"
                onPress={goBackToItemsFallback}
              />
            ) : null,
        }}
      />
      <Stack.Screen
        name="[id]/index"
        options={{
          title: t("navigation.stack.itemDetail"),
          headerLeft: (props) =>
            props.canGoBack ? (
              <HeaderBackButton
                {...props}
                displayMode="minimal"
                testID="itemdetail-header-back"
                onPress={goBackToItemsFallback}
              />
            ) : null,
        }}
      />
      <Stack.Screen
        name="[id]/edit"
        options={{
          title: t("navigation.stack.itemEdit"),
          headerLeft: (props) =>
            props.canGoBack ? (
              <HeaderBackButton
                {...props}
                testID="edititem-header-back"
                onPress={goBackToItemsFallback}
              />
            ) : null,
          presentation: "card",
        }}
      />
    </Stack>
  );
}
