import { useColorScheme as useNativeColorScheme } from "react-native";

import { useThemeMode } from "@/contexts/theme-mode-context";

/**
 * Uses the app-level theme mode on web to keep behavior identical to native.
 */
export function useColorScheme() {
  const systemColorScheme = useNativeColorScheme();
  const { mode } = useThemeMode();

  if (mode === "light") {
    return "light";
  }
  if (mode === "dark") {
    return "dark";
  }
  return systemColorScheme ?? "light";
}
