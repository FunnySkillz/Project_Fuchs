type Listener = () => void;
const localDataDeletedListeners = new Set<Listener>();
const profileSettingsSavedListeners = new Set<Listener>();
const databaseRestoredListeners = new Set<Listener>();

export function emitLocalDataDeleted(): void {
  localDataDeletedListeners.forEach((listener) => {
    listener();
  });
}

export function onLocalDataDeleted(listener: () => void): () => void {
  localDataDeletedListeners.add(listener);
  return () => {
    localDataDeletedListeners.delete(listener);
  };
}

export function emitProfileSettingsSaved(): void {
  profileSettingsSavedListeners.forEach((listener) => {
    listener();
  });
}

export function onProfileSettingsSaved(listener: () => void): () => void {
  profileSettingsSavedListeners.add(listener);
  return () => {
    profileSettingsSavedListeners.delete(listener);
  };
}

export function emitDatabaseRestored(): void {
  databaseRestoredListeners.forEach((listener) => {
    listener();
  });
}

export function onDatabaseRestored(listener: () => void): () => void {
  databaseRestoredListeners.add(listener);
  return () => {
    databaseRestoredListeners.delete(listener);
  };
}
