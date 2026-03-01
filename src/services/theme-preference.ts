import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { DEFAULT_THEME_MODE, type ThemeMode } from "@/theme/theme-mode";

let memoryPreference: ThemeMode = DEFAULT_THEME_MODE;
let hasLoadedPreference = false;

export async function loadThemePreference(): Promise<ThemeMode> {
  if (hasLoadedPreference) {
    return memoryPreference;
  }

  try {
    const repository = await getProfileSettingsRepository();
    const settings = await repository.getSettings();
    memoryPreference = settings.themeModePreference;
  } catch (error) {
    console.warn("Failed to load theme preference from ProfileSettings", error);
  } finally {
    hasLoadedPreference = true;
  }

  return memoryPreference;
}

export async function saveThemePreference(next: ThemeMode): Promise<void> {
  memoryPreference = next;
  hasLoadedPreference = true;

  try {
    const repository = await getProfileSettingsRepository();
    await repository.upsertSettings({ themeModePreference: next });
  } catch (error) {
    console.warn("Failed to persist theme preference to ProfileSettings", error);
  }
}
