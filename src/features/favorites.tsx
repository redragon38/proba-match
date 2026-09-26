'use client';
import { useSyncExternalStore } from 'react';
import { Star } from 'lucide-react';
import { emitAnalytics } from '@/lib/analytics';
import { readPreference, writePreference } from '@/lib/preferences';
const key = 'matchscore-favorites';
const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener('favorites-changed', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('favorites-changed', callback);
  };
};
const snapshot = () => readPreference(key, '[]');
export function useFavorites() {
  const stored = useSyncExternalStore(subscribe, snapshot, () => '[]');
  let values: string[];
  try {
    const parsed: unknown = JSON.parse(stored);
    values = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    values = [];
  }
  const toggle = (id: string) => {
    let current: string[] = values;
    try {
      const parsed = JSON.parse(snapshot());
      if (Array.isArray(parsed)) current = parsed.filter((v) => typeof v === 'string');
    } catch {
      /* Keep the last valid selection. */
    }
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
    writePreference(key, JSON.stringify(next));
    if (!values.includes(id)) emitAnalytics('favorite_added');
    window.dispatchEvent(new Event('favorites-changed'));
  };
  return { values, toggle };
}
export function FavoriteButton({ id, label }: { id: string; label: string }) {
  const { values, toggle } = useFavorites();
  const selected = values.includes(id);
  return (
    <button
      title={selected ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-label={`${selected ? 'Retirer' : 'Ajouter'} ${label} ${selected ? 'des' : 'aux'} favoris`}
      aria-pressed={selected}
      className={`favorite-button ${selected ? 'selected' : ''}`}
      onClick={() => toggle(id)}
    >
      <Star size={16} fill={selected ? 'currentColor' : 'none'} />
    </button>
  );
}
