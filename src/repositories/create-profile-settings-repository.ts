import { getDatabase } from "@/db/sqlite";
import { SQLiteProfileSettingsRepository, type ProfileSettingsRepository } from "@/repositories/profile-settings-repository";

let repositoryPromise: Promise<ProfileSettingsRepository> | null = null;

export function getProfileSettingsRepository(): Promise<ProfileSettingsRepository> {
  if (!repositoryPromise) {
    repositoryPromise = getDatabase().then((db) => new SQLiteProfileSettingsRepository(db));
  }

  return repositoryPromise;
}
