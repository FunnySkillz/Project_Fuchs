import { useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Button, ButtonText, Card, Heading, HStack, Text, VStack } from "@gluestack-ui/themed";

import { useThemeMode } from "@/contexts/theme-mode-context";
import type { ThemeMode } from "@/theme/theme-mode";

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

export default function SettingsAppearanceRoute() {
  const router = useRouter();
  const { mode, resolvedMode, setMode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Box flex={1} px="$5" py="$6" style={{ paddingBottom: insets.bottom + 24 }}>
        <VStack space="lg" maxWidth={860} width="$full" alignSelf="center">
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
            <Heading size="xl">Appearance</Heading>
            <Text size="sm">Choose how the app appearance should be resolved.</Text>
          </VStack>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <HStack space="sm" flexWrap="wrap">
                {themeOptions.map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={mode === option.value ? "solid" : "outline"}
                    action={mode === option.value ? "primary" : "secondary"}
                    onPress={() => setMode(option.value)}
                    testID={`settings-theme-${option.value}`}
                  >
                    <ButtonText>{option.label}</ButtonText>
                  </Button>
                ))}
              </HStack>
              <Text size="sm">Resolved mode now: {resolvedMode}</Text>
            </VStack>
          </Card>
        </VStack>
      </Box>
    </SafeAreaView>
  );
}
