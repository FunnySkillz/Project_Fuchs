import { Tabs, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef } from "react";
import { Download, LayoutDashboard, Plus, Receipt, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/contexts/language-context";
import { useTheme } from "@/hooks/use-theme";

export default function TabsLayout() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const safeAreaBottom = Math.max(insets.bottom, 8);
  const isNavigatingToAddRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isNavigatingToAddRef.current = false;
    }, [])
  );

  const openAddFlow = useCallback(() => {
    if (isNavigatingToAddRef.current) {
      return;
    }
    isNavigatingToAddRef.current = true;
    router.push("/item/new");
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 56 + safeAreaBottom,
          paddingBottom: safeAreaBottom,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("navigation.tabs.home"),
          tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: t("navigation.tabs.items"),
          tabBarIcon: ({ color }) => <Receipt size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="add"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            openAddFlow();
          },
        }}
        options={{
          title: t("navigation.tabs.add"),
          tabBarButtonTestID: "tab-add",
          tabBarIcon: ({ color }) => <Plus size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: t("navigation.tabs.export"),
          tabBarIcon: ({ color }) => <Download size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("navigation.tabs.settings"),
          tabBarIcon: ({ color }) => <Settings size={22} color={color} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}
