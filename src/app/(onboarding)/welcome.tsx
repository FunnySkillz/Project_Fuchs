import { useRouter } from "expo-router";
import React from "react";
import {
  Box,
  Button,
  ButtonText,
  Card,
  Heading,
  Text,
  VStack,
} from "@gluestack-ui/themed";

export default function OnboardingWelcomeRoute() {
  const router = useRouter();

  return (
    <Box flex={1} px="$5" py="$6" justifyContent="center">
      <VStack width="$full" maxWidth={720} alignSelf="center" space="lg">
        <VStack space="xs">
          <Heading size="2xl" textAlign="center">
            Welcome to SteuerFuchs
          </Heading>
          <Text size="sm" textAlign="center">
            Local-first tax preparation for your deductible purchases.
          </Text>
        </VStack>

        <Card borderWidth="$1" borderColor="$border200">
          <VStack space="sm">
            <Heading size="sm">Disclaimer</Heading>
            <Text size="sm">
              This app helps you organize deductible expenses and exports. It is not legal or tax
              advice.
            </Text>
            <Text size="sm">
              Your data stays on this device by default. No account login is required for V1.
            </Text>
          </VStack>
        </Card>

        <Button
          onPress={() => router.push("/(onboarding)/profile-setup")}
          testID="onboarding-welcome-continue"
        >
          <ButtonText>Continue to Profile Setup</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}
