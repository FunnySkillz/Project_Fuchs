import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { getProfileSettingsRepository } from '@/repositories/create-profile-settings-repository';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let isMounted = true;

    const initializeSettings = async () => {
      try {
        const repository = await getProfileSettingsRepository();
        await repository.getSettings();
      } catch (error) {
        if (isMounted) {
          console.error('Failed to initialize profile settings', error);
        }
      }
    };

    void initializeSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
