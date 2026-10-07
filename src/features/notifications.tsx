'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useFavorites } from './favorites';
import { readPreference, writePreference } from '@/lib/preferences';
const subscribe = (callback: () => void) => {
  window.addEventListener('notifications-changed', callback);
  return () => window.removeEventListener('notifications-changed', callback);
};
const key = 'matchscore-notifications';
export function NotificationSettings() {
  const { values } = useFavorites();
  const favoriteKey = values.join('|');
  const enabled = useSyncExternalStore(
    subscribe,
    () => readPreference(key) === 'true',
    () => false,
  );
  const [message, setMessage] = useState('');
  async function enable() {
    if (!('Notification' in window)) {
      setMessage('Ce navigateur ne prend pas en charge les notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      writePreference(key, 'true');
      window.dispatchEvent(new Event('notifications-changed'));
      setMessage('Notifications activées tant que cette page reste ouverte.');
    } else
      setMessage(
        'Autorisation non accordée. Vous pouvez la modifier dans les paramètres du navigateur.',
      );
  }
  function disable() {
    writePreference(key, 'false');
    window.dispatchEvent(new Event('notifications-changed'));
    setMessage('Notifications désactivées.');
  }
  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    let previous: Record<string, string> | null = null;
    let stopped = false;
    async function poll() {
      try {
        if (!favoriteKey) return;
        const response = await fetch(`/api/live?favorites=${encodeURIComponent(favoriteKey)}`);
        if (!response.ok) return;
        const json = (await response.json()) as {
          source: string;
          matches: {
            id: string;
            homeId: string;
            awayId: string;
            competitionId: string;
            label: string;
            homeScore: number | null;
            awayScore: number | null;
            status: string;
            minute: number | null;
            lineup: boolean;
            phase?: string;
            events?: { type: string }[];
          }[];
        };
        const next: Record<string, string> = {};
        for (const m of json.matches) {
          const state = `${m.status}:${m.homeScore}:${m.awayScore}:${m.lineup}:${m.phase ?? ''}:${m.events?.filter((e) => e.type === 'red').length ?? 0}`;
          next[m.id] = state;
          if (
            !stopped &&
            previous?.[m.id] &&
            previous[m.id] !== state &&
            [
              `match:${m.id}`,
              `team:${m.homeId}`,
              `team:${m.awayId}`,
              `competition:${m.competitionId}`,
            ].some((id) => favoriteKey.split('|').includes(id))
          ) {
            new Notification(`${json.source === 'demo' ? '[Démonstration] ' : ''}${m.label}`, {
              body: `${m.homeScore ?? '–'} – ${m.awayScore ?? '–'} · ${m.status === 'live' ? 'En cours' : m.status === 'finished' ? 'Terminé' : 'Mise à jour de la rencontre'}`,
              tag: m.id,
            });
          }
        }
        previous = next;
      } catch {
        /* The next poll retries. */
      }
    }
    void poll();
    const timer = setInterval(poll, 30_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [enabled, favoriteKey]);
  return (
    <section className="card padded">
      <h3>Restez au contact du match</h3>
      <p className="data-note">
        Alertes locales lors d’un changement de score, de statut ou de composition de vos favoris.
        Elles fonctionnent tant que cette page reste ouverte. Les notifications push en arrière-plan
        ne sont pas activées.
      </p>
      <button className="button" onClick={enabled ? disable : enable}>
        {enabled ? 'Désactiver les notifications' : 'Autoriser les notifications'}
      </button>
      <p className="data-note" role="status">
        {message}
      </p>
    </section>
  );
}
