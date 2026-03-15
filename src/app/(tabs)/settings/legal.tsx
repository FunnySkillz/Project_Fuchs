import { useRouter } from "expo-router";
import React from "react";
import { ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Button, ButtonText, Card, Heading, Text, VStack } from "@gluestack-ui/themed";
import { useI18n } from "@/contexts/language-context";

export default function SettingsLegalRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

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
            {!canGoBack && (
              <Button
                variant="outline"
                action="secondary"
                alignSelf="flex-start"
                onPress={() => router.replace("/(tabs)/settings")}
                testID="settings-back-to-main-fallback"
              >
                <ButtonText>{t("common.action.backToSettings")}</ButtonText>
              </Button>
            )}

            <VStack space="xs">
              <Heading size="xl">{t("settings.legal.title")}</Heading>
              <Text size="sm">{t("settings.legal.subtitle")}</Text>
            </VStack>

            <Card borderWidth="$1" borderColor="$warning300">
              <VStack space="sm">
                <Heading size="md">{t("settings.legal.disclaimer.title")}</Heading>
                <Text size="sm" bold testID="settings-legal-disclaimer">
                  {t("settings.legal.disclaimer.estimateOnly")}
                </Text>
                <Text size="sm">
                  {t("settings.legal.disclaimer.body1")}
                </Text>
                <Text size="sm">{t("settings.legal.disclaimer.body2")}</Text>
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="sm">
                <Heading size="md">{t("settings.legal.privacy.title")}</Heading>
                <Text size="sm" testID="settings-legal-privacy">
                  {t("settings.legal.privacy.body1")}
                </Text>
                <Text size="sm">{t("settings.legal.privacy.body2")}</Text>
                <Text size="sm">
                  {t("settings.legal.privacy.contact", { email: "steuerfuchs-support@gmail.com" })}
                </Text>
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="sm">
                <Heading size="md">{t("settings.legal.permissions.title")}</Heading>
                <Text size="sm">{t("settings.legal.permissions.camera")}</Text>
                <Text size="sm">{t("settings.legal.permissions.files")}</Text>
                <Text size="sm">{t("settings.legal.permissions.noHiddenUploads")}</Text>
              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
