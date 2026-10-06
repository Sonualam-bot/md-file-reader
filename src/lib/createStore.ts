import { useSyncExternalStore } from 'react';

/** Minimal global store: `get`/`set` plus a hook that re-renders on change. */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    get: () => state,
    set(next: T) {
      state = next;
      listeners.forEach((l) => l());
    },
    use: () => useSyncExternalStore(subscribe, () => state),
  };
}
