import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useRef } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Card, Heading, Pressable, Text, VStack } from "@gluestack-ui/themed";
import { useI18n } from "@/contexts/language-context";

interface SettingsEntry {
  title: string;
  description: string;
  route: Href;
  testID: string;
}

export default function TabSettingsRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const isNavigatingRef = useRef(false);
  const primaryEntries: SettingsEntry[] = [
    {
      title: t("settings.main.appearance.title"),
      description: t("settings.main.appearance.description"),
      route: "/(tabs)/settings/appearance" as Href,
      testID: "settings-nav-appearance",
    },
    {
      title: t("settings.main.language.title"),
      description: t("settings.main.language.description"),
      route: "/(tabs)/settings/language" as Href,
      testID: "settings-nav-language",
    },
    {
      title: t("settings.main.taxCalculation.title"),
      description: t("settings.main.taxCalculation.description"),
      route: "/(tabs)/settings/tax-calculation" as Href,
      testID: "settings-nav-tax",
    },
    {
      title: t("settings.main.security.title"),
      description: t("settings.main.security.description"),
      route: "/(tabs)/settings/security" as Href,
      testID: "settings-nav-security",
    },
    {
      title: t("settings.main.backupSync.title"),
      description: t("settings.main.backupSync.description"),
      route: "/(tabs)/settings/backup-sync" as Href,
      testID: "settings-nav-backup-sync",
    },
    {
      title: t("settings.main.legal.title"),
      description: t("settings.main.legal.description"),
      route: "/(tabs)/settings/legal" as Href,
      testID: "settings-nav-legal",
    },
  ];

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
              <Heading size="2xl">{t("settings.main.title")}</Heading>
              <Text size="sm">{t("settings.main.subtitle")}</Text>
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
              <Heading size="sm">{t("settings.main.dangerZone.sectionTitle")}</Heading>
              <Pressable
                onPress={() => pushSettingsRoute("/(tabs)/settings/danger-zone" as Href)}
                testID="settings-nav-danger-zone"
              >
                <Card borderWidth="$1" borderColor="$error300">
                  <VStack space="xs">
                    <Heading size="md">{t("settings.main.dangerZone.cardTitle")}</Heading>
                    <Text size="sm">{t("settings.main.dangerZone.cardDescription")}</Text>
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
