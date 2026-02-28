import { useColorScheme as useNativeColorScheme } from "react-native";

import { useThemeMode } from "@/contexts/theme-mode-context";

export function useColorScheme() {
  const systemColorScheme = useNativeColorScheme();
  const { preference } = useThemeMode();

  if (preference === "light") {
    return "light";
  }
  if (preference === "dark") {
    return "dark";
  }
  return systemColorScheme ?? "light";
}
