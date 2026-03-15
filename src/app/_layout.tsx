import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";
import { Redirect, Stack, useSegments } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus, LogBox, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../../global.css";

import { AppLockGate } from "@/components/app-lock-gate";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppGluestackUIProvider } from "@/components/gluestack-ui-provider";
import { LanguageContext } from "@/contexts/language-context";
import { ThemeModeContext } from "@/contexts/theme-mode-context";
import { InitErrorScreen } from "@/components/init-error-screen";
import { MigrationError } from "@/db/migrate";
import { translate, translatePlural, type TranslationKey } from "@/i18n/translate";
import type { AppLanguage } from "@/i18n/types";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import {
  emitLocalDataDeleted,
  onDatabaseRestored,
  onLocalDataDeleted,
  onProfileSettingsSaved,
} from "@/services/app-events";
import { createInitDebugReport, shareDebugReport } from "@/services/debug-report";
import { deleteAllLocalData } from "@/services/local-data";
import {
  loadLanguagePreference,
  saveLanguagePreference,
} from "@/services/language-preference";
import { hasPinAsync, verifyPinAsync } from "@/services/pin-auth";
import {
  loadThemePreference,
  saveThemePreference,
} from "@/services/theme-preference";
import { resolveThemeMode, type ThemeMode } from "@/theme/theme-mode";

interface InitErrorReportPayload {
  message: string;
  rawError: string;
  errorName: string;
  stack?: string;
  migrationVersion?: number;
  occurredAtIso: string;
}

type TranslateFn = (key: TranslationKey, values?: Record<string, string | number>) => string;

function friendlyInitErrorMessage(error: unknown, t: TranslateFn): string {
  if (error instanceof MigrationError) {
    const versionSuffix =
      typeof error.migrationVersion === "number"
        ? ` (migration v${error.migrationVersion})`
        : "";
    return t("app.init.migrationFailedWithVersion", { versionSuffix });
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (lowered.includes("migration")) {
    return t("app.init.migrationFailed");
  }
  if (lowered.includes("database") || lowered.includes("sqlite")) {
    return t("app.init.databaseFailed");
  }
  return message || t("app.init.databaseFailedShort");
}

function buildInitErrorReportPayload(error: unknown, t: TranslateFn): InitErrorReportPayload {
  const rawError = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const stack = error instanceof Error ? error.stack : undefined;
  const migrationVersion =
    error instanceof MigrationError && typeof error.migrationVersion === "number"
      ? error.migrationVersion
      : undefined;

  return {
    message: friendlyInitErrorMessage(error, t),
    rawError,
    errorName,
    stack,
    migrationVersion,
    occurredAtIso: new Date().toISOString(),
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const [bootstrapState, setBootstrapState] = React.useState<"loading" | "ready" | "init_error">("loading");
  const [hasProfile, setHasProfile] = React.useState(false);
  const [appLockEnabled, setAppLockEnabled] = React.useState(false);
  const [isUnlocked, setIsUnlocked] = React.useState(true);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [initError, setInitError] = React.useState<string | null>(null);
  const [initErrorPayload, setInitErrorPayload] = React.useState<InitErrorReportPayload | null>(null);
  const [pinAvailable, setPinAvailable] = React.useState(false);
  const [, setShowPinEntry] = React.useState(false);
  const [pinInput, setPinInput] = React.useState("");
  const [themeMode, setThemeModeState] = React.useState<ThemeMode>("system");
  const [language, setLanguageState] = React.useState<AppLanguage>("en");
  const [isLanguageReady, setIsLanguageReady] = React.useState(false);
  const authInFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const shouldAuthenticateOnNextActiveRef = useRef(false);

  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language]
  );

  useEffect(() => {
    LogBox.ignoreLogs([
      "SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.",
    ]);
  }, []);

  const refreshPinAvailability = useCallback(async () => {
    const hasPin = await hasPinAsync();
    setPinAvailable(hasPin);
    return hasPin;
  }, []);

  const refreshBiometricAvailability = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  }, []);

  const authenticate = useCallback(async () => {
    if (authInFlightRef.current) {
      return;
    }

    authInFlightRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);
    setShowPinEntry(false);
    try {
      const canUseBiometric = await refreshBiometricAvailability();
      if (!canUseBiometric) {
        const hasPin = await refreshPinAvailability();
        if (hasPin) {
          setIsUnlocked(false);
          setShowPinEntry(true);
          return;
        }

        setIsUnlocked(false);
        setAuthError(t("auth.noBiometricNoPin"));
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t("auth.unlockPrompt"),
        cancelLabel: t("common.action.cancel"),
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsUnlocked(true);
        setAuthError(null);
        setPinInput("");
      } else {
        const hasPin = await refreshPinAvailability();
        setIsUnlocked(false);
        setAuthError(
          result.error === "user_cancel"
            ? t("auth.canceledUseFaceOrPin")
            : t("auth.failedRetry")
        );
        if (hasPin) {
          setShowPinEntry(true);
        }
      }
    } catch (error) {
      console.error("Failed during app lock authentication", error);
      setIsUnlocked(false);
      setAuthError(t("auth.failedRetry"));
    } finally {
      authInFlightRef.current = false;
      setIsAuthenticating(false);
    }
  }, [refreshBiometricAvailability, refreshPinAvailability, t]);

  const refreshAppLockState = useCallback(async () => {
    const repository = await getProfileSettingsRepository();
    const hasSettings = await repository.hasValidSettings();
    if (!hasSettings) {
      setHasProfile(false);
      setAppLockEnabled(false);
      return false;
    }

    const settings = await repository.getSettings();
    setHasProfile(true);
    setAppLockEnabled(settings.appLockEnabled);
    return settings.appLockEnabled;
  }, []);

  const syncProfileShellState = useCallback(async () => {
    try {
      const repository = await getProfileSettingsRepository();
      const hasSettings = await repository.hasValidSettings();
      if (!hasSettings) {
        setHasProfile(false);
        setAppLockEnabled(false);
        setIsUnlocked(true);
        setAuthError(null);
        setShowPinEntry(false);
        shouldAuthenticateOnNextActiveRef.current = false;
        return;
      }

      const settings = await repository.getSettings();
      setHasProfile(true);
      setAppLockEnabled(settings.appLockEnabled);
      await refreshPinAvailability();

      if (!settings.appLockEnabled) {
        setIsUnlocked(true);
        setAuthError(null);
        setShowPinEntry(false);
        shouldAuthenticateOnNextActiveRef.current = false;
      }
    } catch (error) {
      console.error("Failed to synchronize profile shell state", error);
    }
  }, [refreshPinAvailability]);

  const handlePinSubmit = useCallback(async () => {
    if (!pinAvailable) {
      setAuthError(t("auth.pinFallbackNotConfigured"));
      return;
    }

    try {
      const result = await verifyPinAsync(pinInput);
      if (result.success) {
        setIsUnlocked(true);
        setAuthError(null);
        setPinInput("");
        return;
      }

      if (result.lockedUntilEpochMs) {
        const seconds = Math.max(1, Math.ceil((result.lockedUntilEpochMs - Date.now()) / 1000));
        setAuthError(t("auth.pinLockedWithSeconds", { seconds }));
      } else {
        setAuthError(t("auth.pinIncorrectWithRemaining", { remaining: result.remainingAttempts }));
      }
    } catch (error) {
      console.error("Failed to verify PIN", error);
      setAuthError(t("auth.pinVerifyFailed"));
    }
  }, [pinAvailable, pinInput, t]);

  useEffect(() => {
    const unsubscribeDelete = onLocalDataDeleted(() => {
      setHasProfile(false);
      setBootstrapState("ready");
      setAppLockEnabled(false);
      setIsUnlocked(true);
      setAuthError(null);
      setInitError(null);
      setPinInput("");
      setShowPinEntry(false);
      setPinAvailable(false);
      setThemeModeState("system");
      setInitErrorPayload(null);
      shouldAuthenticateOnNextActiveRef.current = false;
    });

    const unsubscribeProfileSave = onProfileSettingsSaved(() => {
      setHasProfile(true);
      void syncProfileShellState();
    });
    const unsubscribeDatabaseRestore = onDatabaseRestored(() => {
      setBootstrapState("loading");
    });

    return () => {
      unsubscribeDelete();
      unsubscribeProfileSave();
      unsubscribeDatabaseRestore();
    };
  }, [syncProfileShellState]);

  const retryInitialization = useCallback(() => {
    setBootstrapState("loading");
    setInitError(null);
    setInitErrorPayload(null);
  }, []);

  const exportInitDebugInfo = useCallback(async () => {
    const payload = initErrorPayload ?? {
      message: initError ?? t("app.init.databaseFailedShort"),
      rawError: initError ?? t("app.init.unknownInitializationError"),
      errorName: "InitializationError",
      occurredAtIso: new Date().toISOString(),
    };
    const { fileUri } = await createInitDebugReport({
      errorMessage: payload.message,
      rawError: payload.rawError,
      errorName: payload.errorName,
      stack: payload.stack,
      migrationVersion: payload.migrationVersion,
      timestampIso: payload.occurredAtIso,
    });
    await shareDebugReport(fileUri);
  }, [initError, initErrorPayload, t]);

  const resetLocalDataFromInitError = useCallback(async () => {
    await deleteAllLocalData();
    emitLocalDataDeleted();
  }, []);

  useEffect(() => {
    let active = true;
    const restoreLanguagePreference = async () => {
      const persisted = await loadLanguagePreference();
      if (active) {
        setLanguageState(persisted);
        setIsLanguageReady(true);
      }
    };
    void restoreLanguagePreference();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const restoreThemePreference = async () => {
      const persisted = await loadThemePreference();
      if (active) {
        setThemeModeState(persisted);
      }
    };

    void restoreThemePreference();

    return () => {
      active = false;
    };
  }, []);

  const setThemeMode = useCallback((next: ThemeMode) => {
    setThemeModeState(next);
    void saveThemePreference(next);
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    void saveLanguagePreference(next);
  }, []);

  useEffect(() => {
    if (bootstrapState !== "loading") {
      return;
    }

    let active = true;
    const initialize = async () => {
      if (!active) {
        return;
      }

      try {
        setInitError(null);
        setInitErrorPayload(null);
        const repository = await getProfileSettingsRepository();
        const hasSettings = await repository.hasValidSettings();
        if (!active) {
          return;
        }

        if (!hasSettings) {
          setHasProfile(false);
          setAppLockEnabled(false);
          setIsUnlocked(true);
          setBootstrapState("ready");
          return;
        }

        setHasProfile(true);
        const settings = await repository.getSettings();
        if (!active) {
          return;
        }

        const hasPin = await refreshPinAvailability();
        setAppLockEnabled(settings.appLockEnabled);
        setBootstrapState("ready");
        if (settings.appLockEnabled) {
          setIsUnlocked(false);
          if (hasPin) {
            setShowPinEntry(false);
          }
          void authenticate();
        } else {
          setIsUnlocked(true);
          setAuthError(null);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        console.error("Failed to initialize app", error);
        const localizedPayload = buildInitErrorReportPayload(error, t);
        setInitError(localizedPayload.message);
        setInitErrorPayload(localizedPayload);
        setBootstrapState("init_error");
      }
    };

    void initialize();

    return () => {
      active = false;
    };
  }, [authenticate, bootstrapState, refreshPinAvailability, t]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;

      if (nextState === "background") {
        shouldAuthenticateOnNextActiveRef.current = true;
        return;
      }

      if (nextState !== "active" || bootstrapState !== "ready" || !hasProfile) {
        return;
      }

      if (!shouldAuthenticateOnNextActiveRef.current) {
        return;
      }

      shouldAuthenticateOnNextActiveRef.current = false;

      const checkAndMaybeAuthenticate = async () => {
        try {
          const enabled = await refreshAppLockState();
          await refreshPinAvailability();
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
  }, [authenticate, bootstrapState, hasProfile, refreshAppLockState, refreshPinAvailability]);

  const inOnboarding = segments[0] === "(onboarding)";
  const systemColorMode = colorScheme === "dark" ? "dark" : "light";
  const resolvedColorMode = resolveThemeMode(themeMode, systemColorMode);
  const themeModeContextValue = React.useMemo(
    () => ({
      mode: themeMode,
      resolvedMode: resolvedColorMode,
      setMode: setThemeMode,
    }),
    [resolvedColorMode, setThemeMode, themeMode]
  );
  const languageContextValue = React.useMemo(
    () => ({
      language,
      locale: (language === "de" ? "de-AT" : "en-AT") as "de-AT" | "en-AT",
      setLanguage,
      t: (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
        translate(language, key, values),
      tPlural: (
        key: Parameters<typeof translatePlural>[1],
        count: number,
        values?: Parameters<typeof translatePlural>[3]
      ) => translatePlural(language, key, count, values),
    }),
    [language, setLanguage]
  );

  return (
    <SafeAreaProvider>
      <LanguageContext.Provider value={languageContextValue}>
        <ThemeModeContext.Provider value={themeModeContextValue}>
          <ThemeProvider value={resolvedColorMode === "dark" ? DarkTheme : DefaultTheme}>
            <AppGluestackUIProvider colorMode={resolvedColorMode}>
              <AnimatedSplashOverlay />
              {isLanguageReady && bootstrapState === "ready" && !hasProfile && !inOnboarding && (
                <Redirect href="/(onboarding)/welcome" />
              )}
              {isLanguageReady && bootstrapState === "ready" && hasProfile && inOnboarding && (
                <Redirect href="/(tabs)/home" />
              )}
              {isLanguageReady && bootstrapState === "ready" && (!appLockEnabled || isUnlocked || !hasProfile) && (
                <Stack screenOptions={{ headerShown: false }} />
              )}
              {isLanguageReady && bootstrapState === "ready" && appLockEnabled && !isUnlocked && (
                <AppLockGate
                  isAuthenticating={isAuthenticating}
                  errorMessage={authError}
                  pinEnabled={pinAvailable}
                  pinValue={pinInput}
                  onPinValueChange={setPinInput}
                  onPinSubmit={() => void handlePinSubmit()}
                  onUseBiometric={() => {
                    setShowPinEntry(false);
                    void authenticate();
                  }}
                  onCancel={() => {
                    setIsUnlocked(false);
                    setAuthError(t("auth.canceledUseFaceOrPin"));
                    setShowPinEntry(false);
                  }}
                />
              )}
              {isLanguageReady && bootstrapState === "init_error" && (
                <InitErrorScreen
                  message={initError ?? t("app.init.databaseFailedShort")}
                  onRetry={retryInitialization}
                  onExportDebugInfo={exportInitDebugInfo}
                  onResetData={resetLocalDataFromInitError}
                />
              )}
            </AppGluestackUIProvider>
          </ThemeProvider>
        </ThemeModeContext.Provider>
      </LanguageContext.Provider>
    </SafeAreaProvider>
  );
}
