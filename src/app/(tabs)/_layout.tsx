import { Tabs, useRouter } from "expo-router";
import React from "react";
import { Download, LayoutDashboard, Plus, Receipt, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";

export default function TabsLayout() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const safeAreaBottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
          title: "Home",
          tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          tabBarIcon: ({ color }) => <Receipt size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="add"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/item/new");
          },
        }}
        options={{
          title: "Add",
          tabBarButtonTestID: "tab-add",
          tabBarIcon: ({ color }) => <Plus size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: "Export",
          tabBarIcon: ({ color }) => <Download size={22} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings size={22} color={color} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}
