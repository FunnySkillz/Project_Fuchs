import React from "react";

export type ThemeModePreference = "system" | "light" | "dark";
export type ThemeModeResolved = "light" | "dark";

export interface ThemeModeContextValue {
  preference: ThemeModePreference;
  resolvedColorMode: ThemeModeResolved;
  setPreference: (next: ThemeModePreference) => void;
}

const noop = () => undefined;

export const ThemeModeContext = React.createContext<ThemeModeContextValue>({
  preference: "system",
  resolvedColorMode: "light",
  setPreference: noop,
});

export function useThemeMode(): ThemeModeContextValue {
  return React.useContext(ThemeModeContext);
}
