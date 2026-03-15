import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import type { AppLanguage } from "@/i18n/types";

const FALLBACK_LANGUAGE: AppLanguage = "en";

let memoryPreference: AppLanguage = FALLBACK_LANGUAGE;
let hasLoadedPreference = false;

function detectDeviceLanguage(): AppLanguage {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    return FALLBACK_LANGUAGE;
  }
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return locale.startsWith("de") ? "de" : "en";
}

function isLanguageValue(value: unknown): value is AppLanguage {
  return value === "en" || value === "de";
}

export async function loadLanguagePreference(): Promise<AppLanguage> {
  if (hasLoadedPreference) {
    return memoryPreference;
  }

  try {
    const repository = await getProfileSettingsRepository();
    const languageGetter = (repository as { getLanguagePreference?: () => Promise<unknown> })
      .getLanguagePreference;

    if (typeof languageGetter === "function") {
      const saved = await languageGetter.call(repository);
      if (isLanguageValue(saved)) {
        memoryPreference = saved;
        return memoryPreference;
      }
    }

    const detected = detectDeviceLanguage();
    memoryPreference = detected;

    await repository.getSettings();

    const languageSetter = (repository as { setLanguagePreference?: (next: AppLanguage) => Promise<void> })
      .setLanguagePreference;
    if (typeof languageSetter === "function") {
      await languageSetter.call(repository, detected);
    }
  } catch (error) {
    console.warn("Failed to load language preference from ProfileSettings", error);
    memoryPreference = detectDeviceLanguage();
  } finally {
    hasLoadedPreference = true;
  }

  return memoryPreference;
}

export async function saveLanguagePreference(next: AppLanguage): Promise<void> {
  memoryPreference = next;
  hasLoadedPreference = true;

  try {
    const repository = await getProfileSettingsRepository();
    const languageSetter = (repository as { setLanguagePreference?: (value: AppLanguage) => Promise<void> })
      .setLanguagePreference;
    if (typeof languageSetter === "function") {
      await languageSetter.call(repository, next);
    }
  } catch (error) {
    console.warn("Failed to persist language preference to ProfileSettings", error);
  }
}

export function getCachedLanguagePreference(): AppLanguage {
  return memoryPreference;
}
