import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, useColorScheme } from 'react-native';

import { AppLockGate } from '@/components/app-lock-gate';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { OnboardingFlow } from '@/components/onboarding-flow';
import { getProfileSettingsRepository } from '@/repositories/create-profile-settings-repository';
import { type ProfileSettingsFormValues } from '@/components/profile-settings-form';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [bootstrapState, setBootstrapState] = React.useState<"loading" | "needs_onboarding" | "ready">("loading");
  const [appLockEnabled, setAppLockEnabled] = React.useState(false);
  const [isUnlocked, setIsUnlocked] = React.useState(true);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const authInFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const authenticate = useCallback(async () => {
    if (authInFlightRef.current) {
      return;
    }

    authInFlightRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock SteuerFuchs",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsUnlocked(true);
        setAuthError(null);
      } else {
        setIsUnlocked(false);
        setAuthError(
          result.error === "user_cancel"
            ? "Authentication canceled."
            : "Authentication failed. Please retry."
        );
      }
    } catch (error) {
      console.error("Failed during app lock authentication", error);
      setIsUnlocked(false);
      setAuthError("Authentication failed. Please retry.");
    } finally {
      authInFlightRef.current = false;
      setIsAuthenticating(false);
    }
  }, []);

  const refreshAppLockState = useCallback(async () => {
    const repository = await getProfileSettingsRepository();
    const settings = await repository.getSettings();
    setAppLockEnabled(settings.appLockEnabled);
    return settings.appLockEnabled;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        const repository = await getProfileSettingsRepository();
        const hasSettings = await repository.hasSettings();
        if (!isMounted) {
          return;
        }

        if (!hasSettings) {
          setBootstrapState("needs_onboarding");
          return;
        }

        const settings = await repository.getSettings();
        if (!isMounted) {
          return;
        }

        setAppLockEnabled(settings.appLockEnabled);
        setBootstrapState("ready");

        if (settings.appLockEnabled) {
          setIsUnlocked(false);
          void authenticate();
        } else {
          setIsUnlocked(true);
          setAuthError(null);
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
  }, [authenticate]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasInBackground =
        appStateRef.current === "background" || appStateRef.current === "inactive";
      appStateRef.current = nextState;
      if (!wasInBackground || nextState !== "active" || bootstrapState !== "ready") {
        return;
      }

      const checkAndMaybeAuthenticate = async () => {
        try {
          const enabled = await refreshAppLockState();
          if (!enabled) {
            setIsUnlocked(true);
            setAuthError(null);
            return;
          }

          setIsUnlocked(false);
          void authenticate();
        } catch (error) {
          console.error("Failed to refresh lock state on app resume", error);
        }
      };

      void checkAndMaybeAuthenticate();
    });

    return () => {
      subscription.remove();
    };
  }, [authenticate, bootstrapState, refreshAppLockState]);

  const handleOnboardingComplete = async (values: ProfileSettingsFormValues) => {
    const repository = await getProfileSettingsRepository();
    const updated = await repository.upsertSettings(values);
    setAppLockEnabled(updated.appLockEnabled);
    setBootstrapState("ready");
    if (updated.appLockEnabled) {
      setIsUnlocked(false);
      void authenticate();
    } else {
      setIsUnlocked(true);
    }
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {bootstrapState === "ready" && (!appLockEnabled || isUnlocked) && <AppTabs />}
      {bootstrapState === "ready" && appLockEnabled && !isUnlocked && (
        <AppLockGate
          isAuthenticating={isAuthenticating}
          errorMessage={authError}
          onRetry={() => void authenticate()}
          onCancel={() => {
            setIsUnlocked(false);
            setAuthError("Authentication canceled.");
          }}
        />
      )}
      {bootstrapState === "needs_onboarding" && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}
    </ThemeProvider>
  );
}
