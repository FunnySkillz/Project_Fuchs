import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { OnboardingFlow } from '@/components/onboarding-flow';
import { getProfileSettingsRepository } from '@/repositories/create-profile-settings-repository';
import { type ProfileSettingsFormValues } from '@/components/profile-settings-form';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [bootstrapState, setBootstrapState] = React.useState<"loading" | "needs_onboarding" | "ready">("loading");

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        const repository = await getProfileSettingsRepository();
        const hasSettings = await repository.hasSettings();
        if (isMounted) {
          setBootstrapState(hasSettings ? "ready" : "needs_onboarding");
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to initialize app', error);
          setBootstrapState("needs_onboarding");
        }
      }
    };

    void initializeApp();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOnboardingComplete = async (values: ProfileSettingsFormValues) => {
    const repository = await getProfileSettingsRepository();
    await repository.upsertSettings(values);
    setBootstrapState("ready");
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {bootstrapState === "ready" && <AppTabs />}
      {bootstrapState === "needs_onboarding" && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}
    </ThemeProvider>
  );
}
