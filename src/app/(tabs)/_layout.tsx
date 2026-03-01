import { Tabs } from "expo-router";
import React from "react";
import { Download, LayoutDashboard, Receipt, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const mutedForeground = theme.textSecondary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: mutedForeground,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingTop: 6,
          paddingBottom: bottomInset,
          height: 56 + bottomInset,
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
          tabBarIcon: ({ color }) => (
            <LayoutDashboard size={22} color={color} strokeWidth={1.8} testID="tabicon-home" />
          ),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          tabBarIcon: ({ color }) => (
            <Receipt size={22} color={color} strokeWidth={1.8} testID="tabicon-items" />
          ),
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: "Export",
          tabBarIcon: ({ color }) => (
            <Download size={22} color={color} strokeWidth={1.8} testID="tabicon-export" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Settings size={22} color={color} strokeWidth={1.8} testID="tabicon-settings" />
          ),
        }}
      />
    </Tabs>
  );
}
