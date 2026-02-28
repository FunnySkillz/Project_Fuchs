import type { ThemeModePreference } from "@/contexts/theme-mode-context";

const STORAGE_KEY = "steuerfuchs.theme.preference";
let memoryPreference: ThemeModePreference = "system";

function isThemeModePreference(value: string): value is ThemeModePreference {
  return value === "system" || value === "light" || value === "dark";
}

function readFromLocalStorage(): ThemeModePreference | null {
  try {
    const candidate = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!candidate || !isThemeModePreference(candidate)) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

function writeToLocalStorage(value: ThemeModePreference): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore persistence errors (e.g. private mode or unavailable storage).
  }
}

export async function loadThemePreference(): Promise<ThemeModePreference> {
  const persisted = readFromLocalStorage();
  if (persisted) {
    memoryPreference = persisted;
  }
  return memoryPreference;
}

export async function saveThemePreference(next: ThemeModePreference): Promise<void> {
  memoryPreference = next;
  writeToLocalStorage(next);
}
