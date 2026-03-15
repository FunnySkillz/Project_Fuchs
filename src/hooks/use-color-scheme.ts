import { useColorScheme as useNativeColorScheme } from "react-native";

import { useThemeMode } from "@/contexts/theme-mode-context";

export type AppColorScheme = "light" | "dark";

export function useColorScheme(): AppColorScheme {
  const systemColorScheme = useNativeColorScheme();
  const { mode } = useThemeMode();

  if (mode === "light") {
    return "light";
  }
  if (mode === "dark") {
    return "dark";
  }
  return systemColorScheme === "dark" ? "dark" : "light";
}
