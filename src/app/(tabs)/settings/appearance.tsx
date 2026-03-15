import { useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Button, ButtonText, Card, Heading, HStack, Text, VStack } from "@gluestack-ui/themed";

import { useI18n } from "@/contexts/language-context";
import { useThemeMode } from "@/contexts/theme-mode-context";
import { useTheme } from "@/hooks/use-theme";
import type { ThemeMode } from "@/theme/theme-mode";

export default function SettingsAppearanceRoute() {
  const router = useRouter();
  const { mode, resolvedMode, setMode } = useThemeMode();
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const themeOptions: { label: string; value: ThemeMode }[] = [
    { label: t("settings.appearance.system"), value: "system" },
    { label: t("settings.appearance.light"), value: "light" },
    { label: t("settings.appearance.dark"), value: "dark" },
  ];
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
              <ButtonText color={theme.text}>{t("common.action.backToSettings")}</ButtonText>
            </Button>
          )}

          <VStack space="xs">
            <Heading size="xl" color={theme.text}>{t("settings.appearance.title")}</Heading>
            <Text size="sm" color={theme.textSecondary}>{t("settings.appearance.subtitle")}</Text>
          </VStack>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <HStack space="sm" flexWrap="wrap">
                {themeOptions.map((option) => {
                  const isSelected = mode === option.value;
                  return (
                    <Button
                      key={option.value}
                      size="sm"
                      variant="outline"
                      action="secondary"
                      onPress={() => setMode(option.value)}
                      testID={`settings-theme-${option.value}`}
                      accessibilityState={{ selected: isSelected }}
                      style={{
                        backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                        borderColor: isSelected ? theme.primary : theme.border,
                      }}
                    >
                      <ButtonText color={isSelected ? theme.textOnPrimary : theme.text}>
                        {option.label}
                      </ButtonText>
                    </Button>
                  );
                })}
              </HStack>
              <Text size="sm" color={theme.textSecondary}>
                {t("settings.appearance.resolvedNow", { mode: resolvedMode })}
              </Text>
            </VStack>
          </Card>
        </VStack>
      </Box>
    </SafeAreaView>
  );
}
