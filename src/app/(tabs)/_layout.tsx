import { Tabs, useRouter } from "expo-router";
import React from "react";
import { Pressable } from "react-native";
import { Download, LayoutDashboard, Plus, Receipt, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";

export default function TabsLayout() {
  const router = useRouter();
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
        name="add"
        options={{
          title: "Add",
          tabBarLabel: "",
          tabBarButton: ({ accessibilityState }) => {
            const selected = accessibilityState?.selected ?? false;
            return (
              <Pressable
                onPress={() => router.push("/item/new")}
                testID="tab-add"
                accessibilityLabel="Add Item"
                accessibilityRole="button"
                style={({ pressed }) => ({
                  alignSelf: "center",
                  marginTop: -6,
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: theme.primary,
                  shadowColor: theme.text,
                  shadowOpacity: 0.14,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                  opacity: pressed ? 0.9 : 1,
                  borderWidth: selected ? 1 : 0,
                  borderColor: theme.border,
                })}
              >
                <Plus size={24} color={theme.textOnPrimary} strokeWidth={2.1} />
              </Pressable>
            );
          },
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
