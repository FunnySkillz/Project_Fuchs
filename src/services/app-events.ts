type Listener = () => void;
const listeners = new Set<Listener>();

export function emitLocalDataDeleted(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

export function onLocalDataDeleted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
