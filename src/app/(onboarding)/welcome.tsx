import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Box,
  Button,
  ButtonText,
  Card,
  Heading,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { useI18n } from "@/contexts/language-context";

export default function OnboardingWelcomeRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const isNavigatingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
    }, [])
  );

  const continueToProfileSetup = useCallback(() => {
    if (isNavigatingRef.current) {
      return;
    }
    isNavigatingRef.current = true;
    router.push("/(onboarding)/profile-setup");
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <Box
        flex={1}
        px="$5"
        justifyContent="center"
        style={{ paddingTop: 24, paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <VStack width="$full" maxWidth={720} alignSelf="center" space="lg">
          <VStack space="xs">
            <Heading size="2xl" textAlign="center">
              {t("onboarding.welcome.title")}
            </Heading>
            <Text size="sm" textAlign="center">
              {t("onboarding.welcome.subtitle")}
            </Text>
          </VStack>

          <Card borderWidth="$1" borderColor="$border200">
            <VStack space="sm">
              <Heading size="sm">{t("onboarding.welcome.disclaimerTitle")}</Heading>
              <Text size="sm">
                {t("onboarding.welcome.disclaimerBody")}
              </Text>
            </VStack>
          </Card>

          <Button
            onPress={continueToProfileSetup}
            testID="onboarding-welcome-continue"
          >
            <ButtonText>{t("onboarding.welcome.cta")}</ButtonText>
          </Button>
        </VStack>
      </Box>
    </SafeAreaView>
  );
}
