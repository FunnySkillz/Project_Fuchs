import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useRef } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Card, Heading, Pressable, Text, VStack } from "@gluestack-ui/themed";

interface SettingsEntry {
  title: string;
  description: string;
  route: Href;
  testID: string;
}

const primaryEntries: SettingsEntry[] = [
  {
    title: "Appearance",
    description: "Theme mode and visual behavior.",
    route: "/(tabs)/settings/appearance" as Href,
    testID: "settings-nav-appearance",
  },
  {
    title: "Tax & Calculation",
    description: "Tax defaults and deduction assumptions.",
    route: "/(tabs)/settings/tax-calculation" as Href,
    testID: "settings-nav-tax",
  },
  {
    title: "Security",
    description: "App lock and PIN fallback.",
    route: "/(tabs)/settings/security" as Href,
    testID: "settings-nav-security",
  },
  {
    title: "Backup & Sync",
    description: "Backup restore, OneDrive, and export pipeline.",
    route: "/(tabs)/settings/backup-sync" as Href,
    testID: "settings-nav-backup-sync",
  },
  {
    title: "Legal & Privacy",
    description: "Disclaimer, privacy statement, and permission usage.",
    route: "/(tabs)/settings/legal" as Href,
    testID: "settings-nav-legal",
  },
];

export default function TabSettingsRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isNavigatingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
    }, [])
  );

  const pushSettingsRoute = useCallback(
    (route: Href) => {
      if (isNavigatingRef.current) {
        return;
      }
      isNavigatingRef.current = true;
      router.push(route);
    },
    [router]
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Box flex={1} px="$5">
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={{
            maxWidth: 860,
            width: "100%",
            alignSelf: "center",
            paddingTop: 24,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <VStack space="lg">
            <VStack space="xs">
              <Heading size="2xl">Settings</Heading>
              <Text size="sm">Choose a section to manage app behavior and preferences.</Text>
            </VStack>

            {primaryEntries.map((entry) => (
              <Pressable
                key={entry.testID}
                onPress={() => pushSettingsRoute(entry.route)}
                testID={entry.testID}
              >
                <Card borderWidth="$1" borderColor="$border200">
                  <VStack space="xs">
                    <Heading size="md">{entry.title}</Heading>
                    <Text size="sm">{entry.description}</Text>
                  </VStack>
                </Card>
              </Pressable>
            ))}

            <VStack space="sm" pt="$2">
              <Heading size="sm">Danger Zone</Heading>
              <Pressable
                onPress={() => pushSettingsRoute("/(tabs)/settings/danger-zone" as Href)}
                testID="settings-nav-danger-zone"
              >
                <Card borderWidth="$1" borderColor="$error300">
                  <VStack space="xs">
                    <Heading size="md">Delete Local Data</Heading>
                    <Text size="sm">Irreversible local reset and data wipe.</Text>
                  </VStack>
                </Card>
              </Pressable>
            </VStack>
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
