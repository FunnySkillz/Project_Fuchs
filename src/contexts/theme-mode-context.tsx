import React from "react";
import type { ThemeMode, ThemeModeResolved } from "@/theme/theme-mode";

export interface ThemeModeContextValue {
  mode: ThemeMode;
  resolvedMode: ThemeModeResolved;
  setMode: (next: ThemeMode) => void;
}

const noop = () => undefined;

export const ThemeModeContext = React.createContext<ThemeModeContextValue>({
  mode: "system",
  resolvedMode: "light",
  setMode: noop,
});

export function useThemeMode(): ThemeModeContextValue {
  return React.useContext(ThemeModeContext);
}

export function useIsDark(): boolean {
  const { resolvedMode } = useThemeMode();
  return resolvedMode === "dark";
}
