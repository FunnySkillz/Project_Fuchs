import { useRouter } from "expo-router";
import React from "react";
import { ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Button, ButtonText, Card, Heading, Text, VStack } from "@gluestack-ui/themed";

export default function SettingsLegalRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
                <ButtonText>Back to Settings</ButtonText>
              </Button>
            )}

            <VStack space="xs">
              <Heading size="xl">Legal & Privacy</Heading>
              <Text size="sm">Important usage notice and privacy summary for SteuerFuchs.</Text>
            </VStack>

            <Card borderWidth="$1" borderColor="$warning300">
              <VStack space="sm">
                <Heading size="md">Disclaimer</Heading>
                <Text size="sm" bold testID="settings-legal-disclaimer">
                  No tax advice, estimates only.
                </Text>
                <Text size="sm">
                  SteuerFuchs provides calculation support and export tools. It does not replace professional tax
                  advice, legal guidance, or official tax filing validation.
                </Text>
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="sm">
                <Heading size="md">Privacy Statement</Heading>
                <Text size="sm" testID="settings-legal-privacy">
                  Your data is stored locally on your device. SteuerFuchs does not include tracking or analytics.
                  Files leave your device only when you explicitly export or share them.
                </Text>
                <Text size="sm">
                  OneDrive is optional and export-only. It is never required for local-first app usage.
                </Text>
                <Text size="sm">Privacy/support contact: support@steuerfuchs.app</Text>
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="sm">
                <Heading size="md">Permission Usage</Heading>
                <Text size="sm">Camera: capture receipt photos.</Text>
                <Text size="sm">Photos/Files: attach receipt images or PDFs.</Text>
                <Text size="sm">No hidden background uploads are performed.</Text>
              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
