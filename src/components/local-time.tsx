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
  compactDate = false,
  known = true,
  sourceDate,
}: {
  iso: string;
  date?: boolean;
  compactDate?: boolean;
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
          day: compactDate ? '2-digit' : 'numeric',
          month: compactDate ? '2-digit' : 'long',
          year: compactDate ? '2-digit' : 'numeric',
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
              ? compactDate
                ? { day: '2-digit', month: '2-digit', year: '2-digit' }
                : { day: 'numeric', month: 'long', year: 'numeric' }
              : { hour: '2-digit', minute: '2-digit' },
          )
        : date
          ? compactDate
            ? new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                timeZone: 'Europe/Paris',
              }).format(new Date(iso))
            : dayLabel(iso)
          : time(iso)}
    </time>
  );
}
