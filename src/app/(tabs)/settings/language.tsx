import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Button, ButtonText, Card, Heading, HStack, Text, VStack } from "@gluestack-ui/themed";

import { useI18n } from "@/contexts/language-context";
import { useTheme } from "@/hooks/use-theme";
import type { AppLanguage } from "@/i18n/types";

const languageOptions: { key: AppLanguage; labelKey: "settings.language.optionEnglish" | "settings.language.optionGerman" }[] =
  [
    { key: "en", labelKey: "settings.language.optionEnglish" },
    { key: "de", labelKey: "settings.language.optionGerman" },
  ];

export default function SettingsLanguageRoute() {
  const router = useRouter();
  const { language, locale, setLanguage, t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

  const formattedExamples = useMemo(() => {
    return {
      amount: new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(1234.56),
      number: new Intl.NumberFormat(locale).format(1234567.89),
      percent: new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(0.276),
    };
  }, [locale]);

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
            <Heading size="xl" color={theme.text}>{t("settings.language.title")}</Heading>
            <Text size="sm" color={theme.textSecondary}>{t("settings.language.subtitle")}</Text>
          </VStack>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="md">
              <HStack space="sm" flexWrap="wrap">
                {languageOptions.map((option) => {
                  const isSelected = language === option.key;
                  return (
                    <Button
                      key={option.key}
                      size="sm"
                      variant="outline"
                      action="secondary"
                      onPress={() => setLanguage(option.key)}
                      testID={`settings-language-${option.key}`}
                      accessibilityState={{ selected: isSelected }}
                      style={{
                        backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                        borderColor: isSelected ? theme.primary : theme.border,
                      }}
                    >
                      <ButtonText color={isSelected ? theme.textOnPrimary : theme.text}>
                        {t(option.labelKey)}
                      </ButtonText>
                    </Button>
                  );
                })}
              </HStack>
              <Text size="sm" color={theme.textSecondary}>
                {t("settings.language.activeLabel", {
                  language:
                    language === "de"
                      ? t("settings.language.currentGerman")
                      : t("settings.language.currentEnglish"),
                })}
              </Text>
              <VStack space="xs">
                <Text size="sm" color={theme.textSecondary}>
                  {t("settings.language.exampleCurrency", { amount: formattedExamples.amount })}
                </Text>
                <Text size="sm" color={theme.textSecondary}>
                  {t("settings.language.exampleNumber", { value: formattedExamples.number })}
                </Text>
                <Text size="sm" color={theme.textSecondary}>
                  {t("settings.language.examplePercent", { value: formattedExamples.percent })}
                </Text>
              </VStack>
            </VStack>
          </Card>
        </VStack>
      </Box>
    </SafeAreaView>
  );
}
