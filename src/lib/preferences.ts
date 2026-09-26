'use client';
import { useSyncExternalStore } from 'react';
const memory = new Map<string, string>();
export function readPreference(key: string, fallback = '') {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? fallback;
  } catch {
    return memory.get(key) ?? fallback;
  }
}
export function writePreference(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private storage: keep session preference. */
  }
  window.dispatchEvent(new Event('preferences-changed'));
}
const subscribe = (notify: () => void) => {
  window.addEventListener('preferences-changed', notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener('preferences-changed', notify);
    window.removeEventListener('storage', notify);
  };
};
export function usePreference(key: string, fallback: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => readPreference(key, fallback),
    () => fallback,
  );
  return [value, (next: string) => writePreference(key, next)] as const;
}
