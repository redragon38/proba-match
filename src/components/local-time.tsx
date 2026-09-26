'use client';
import { useSyncExternalStore } from 'react';
import { time, dayLabel } from '@/lib/format';
const subscribe = () => () => {};
export function useTimeZone() {
  return useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => 'Europe/Paris',
  );
}
export function LocalTime({
  iso,
  date = false,
  known = true,
  sourceDate,
}: {
  iso: string;
  date?: boolean;
  known?: boolean;
  sourceDate?: string;
}) {
  const local = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!known && !date) return <span>Heure à confirmer</span>;
  if (!known && date) {
    const day = sourceDate ?? iso.slice(0, 10);
    return (
      <time dateTime={day}>
        {new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })}
      </time>
    );
  }
  return (
    <time
      dateTime={iso}
      title={local ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Paris'}
    >
      {local
        ? new Date(iso).toLocaleString(
            'fr-FR',
            date
              ? { day: 'numeric', month: 'long', year: 'numeric' }
              : { hour: '2-digit', minute: '2-digit' },
          )
        : date
          ? dayLabel(iso)
          : time(iso)}
    </time>
  );
}
