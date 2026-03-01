export type ThemeMode = "system" | "light" | "dark";
export type ThemeModeResolved = "light" | "dark";

export const DEFAULT_THEME_MODE: ThemeMode = "system";

export function isThemeMode(value: string): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveThemeMode(
  mode: ThemeMode,
  systemMode: ThemeModeResolved
): ThemeModeResolved {
  if (mode === "system") {
    return systemMode;
  }
  return mode;
}
