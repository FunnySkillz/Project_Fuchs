import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Tabs, useRouter } from "expo-router";
import { Download, LayoutDashboard, Plus, Receipt, Settings } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";

export default function TabsLayout() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const safeAreaBottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      tabBar={(props) => (
        <View style={styles.tabBarHost}>
          <BottomTabBar {...props} />
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View style={styles.fabContainer} pointerEvents="box-none">
              <Pressable
                testID="tab-add-center"
                accessibilityRole="button"
                accessibilityLabel="Add Item"
                onPress={() => router.push("/item/new")}
                style={({ pressed }) => [
                  styles.fab,
                  {
                    bottom: safeAreaBottom + 12,
                    backgroundColor: theme.primary,
                    shadowColor: theme.text,
                  },
                  pressed && styles.fabPressed,
                ]}
              >
                <Plus size={24} color={theme.textOnPrimary} strokeWidth={2.1} />
              </Pressable>
            </View>
          </View>
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 56 + safeAreaBottom,
          paddingBottom: safeAreaBottom,
          paddingTop: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        tabBarItemStyle: {
          flex: 1,
        },
        tabBarHideOnKeyboard: false,
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
        listeners={{
          tabPress: (e) => e.preventDefault(),
        }}
        options={{
          href: null,
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

const styles = StyleSheet.create({
  tabBarHost: {
    position: "relative",
  },
  fabContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 20,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    position: "absolute",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabPressed: {
    opacity: 0.9,
  },
});
