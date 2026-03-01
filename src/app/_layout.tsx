import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";
import { Redirect, Slot, useSegments } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus, LogBox, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../../global.css";

import { AppLockGate } from "@/components/app-lock-gate";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppGluestackUIProvider } from "@/components/gluestack-ui-provider";
import { ThemeModeContext } from "@/contexts/theme-mode-context";
import { InitErrorScreen } from "@/components/init-error-screen";
import { MigrationError } from "@/db/migrate";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import {
  emitLocalDataDeleted,
  onDatabaseRestored,
  onLocalDataDeleted,
  onProfileSettingsSaved,
} from "@/services/app-events";
import { createInitDebugReport, shareDebugReport } from "@/services/debug-report";
import { deleteAllLocalData } from "@/services/local-data";
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

function friendlyInitErrorMessage(error: unknown): string {
  if (error instanceof MigrationError) {
    const versionSuffix =
      typeof error.migrationVersion === "number"
        ? ` (migration v${error.migrationVersion})`
        : "";
    return `Database migration failed${versionSuffix}. Retry initialization. If it still fails, export debug info and use 'Reset Local Data'.`;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (lowered.includes("migration")) {
    return "Database migration failed. Retry initialization. If it still fails, export debug info and use 'Reset Local Data' to recover.";
  }
  if (lowered.includes("database") || lowered.includes("sqlite")) {
    return "Database initialization failed. Retry first. If the error persists, export debug info and use 'Reset Local Data' to rebuild local storage.";
  }
  return message || "Database initialization failed.";
}

function buildInitErrorReportPayload(error: unknown): InitErrorReportPayload {
  const rawError = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const stack = error instanceof Error ? error.stack : undefined;
  const migrationVersion =
    error instanceof MigrationError && typeof error.migrationVersion === "number"
      ? error.migrationVersion
      : undefined;

  return {
    message: friendlyInitErrorMessage(error),
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
  const [showPinEntry, setShowPinEntry] = React.useState(false);
  const [pinInput, setPinInput] = React.useState("");
  const [themeMode, setThemeModeState] = React.useState<ThemeMode>("system");
  const authInFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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
        setAuthError("No biometric method available and no PIN configured.");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock SteuerFuchs",
        cancelLabel: "Cancel",
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
            ? "Authentication canceled."
            : "Authentication failed. Please retry."
        );
        if (hasPin) {
          setShowPinEntry(true);
        }
      }
    } catch (error) {
      console.error("Failed during app lock authentication", error);
      setIsUnlocked(false);
      setAuthError("Authentication failed. Please retry.");
    } finally {
      authInFlightRef.current = false;
      setIsAuthenticating(false);
    }
  }, [refreshBiometricAvailability, refreshPinAvailability]);

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

  const handlePinSubmit = useCallback(async () => {
    if (!pinAvailable) {
      setAuthError("PIN fallback is not configured.");
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
        setAuthError(`Too many failed PIN attempts. Try again in ${seconds}s.`);
      } else {
        setAuthError(`Incorrect PIN. ${result.remainingAttempts} attempt(s) remaining before delay.`);
      }
    } catch (error) {
      console.error("Failed to verify PIN", error);
      setAuthError("PIN verification failed. Please retry.");
    }
  }, [pinAvailable, pinInput]);

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
    });

    const unsubscribeProfileSave = onProfileSettingsSaved(() => {
      setHasProfile(true);
      setBootstrapState("loading");
    });
    const unsubscribeDatabaseRestore = onDatabaseRestored(() => {
      setBootstrapState("loading");
    });

    return () => {
      unsubscribeDelete();
      unsubscribeProfileSave();
      unsubscribeDatabaseRestore();
    };
  }, []);

  const retryInitialization = useCallback(() => {
    setBootstrapState("loading");
    setInitError(null);
    setInitErrorPayload(null);
  }, []);

  const exportInitDebugInfo = useCallback(async () => {
    const payload = initErrorPayload ?? {
      message: initError ?? "Database initialization failed.",
      rawError: initError ?? "Unknown initialization error.",
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
  }, [initError, initErrorPayload]);

  const resetLocalDataFromInitError = useCallback(async () => {
    await deleteAllLocalData();
    emitLocalDataDeleted();
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
        const payload = buildInitErrorReportPayload(error);
        setInitError(payload.message);
        setInitErrorPayload(payload);
        setBootstrapState("init_error");
      }
    };

    void initialize();

    return () => {
      active = false;
    };
  }, [authenticate, bootstrapState, refreshPinAvailability]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasInBackground = appStateRef.current === "background" || appStateRef.current === "inactive";
      appStateRef.current = nextState;
      if (!wasInBackground || nextState !== "active" || bootstrapState !== "ready" || !hasProfile) {
        return;
      }

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

  return (
    <SafeAreaProvider>
      <ThemeModeContext.Provider value={themeModeContextValue}>
        <ThemeProvider value={resolvedColorMode === "dark" ? DarkTheme : DefaultTheme}>
          <AppGluestackUIProvider colorMode={resolvedColorMode}>
            <AnimatedSplashOverlay />
            {bootstrapState === "ready" && !hasProfile && !inOnboarding && <Redirect href="/(onboarding)/welcome" />}
            {bootstrapState === "ready" && hasProfile && inOnboarding && <Redirect href="/(tabs)/home" />}
            {bootstrapState === "ready" && (!appLockEnabled || isUnlocked || !hasProfile) && <Slot />}
            {bootstrapState === "ready" && appLockEnabled && !isUnlocked && (
              <AppLockGate
                isAuthenticating={isAuthenticating}
                errorMessage={authError}
                pinEnabled={pinAvailable}
                pinValue={pinInput}
                onPinValueChange={setPinInput}
                onPinSubmit={() => void handlePinSubmit()}
                onUsePin={() => setShowPinEntry(true)}
                onUseBiometric={() => {
                  setShowPinEntry(false);
                  void authenticate();
                }}
                showPinEntry={showPinEntry}
                onRetry={() => void authenticate()}
                onCancel={() => {
                  setIsUnlocked(false);
                  setAuthError("Authentication canceled.");
                  setShowPinEntry(false);
                }}
              />
            )}
            {bootstrapState === "init_error" && (
              <InitErrorScreen
                message={initError ?? "Database initialization failed."}
                onRetry={retryInitialization}
                onExportDebugInfo={exportInitDebugInfo}
                onResetData={resetLocalDataFromInitError}
              />
            )}
          </AppGluestackUIProvider>
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </SafeAreaProvider>
  );
}
