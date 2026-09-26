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
}: {
  iso: string;
  date?: boolean;
  known?: boolean;
}) {
  const local = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!known && !date) return <span>Heure à confirmer</span>;
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
