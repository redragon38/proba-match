'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { dateKey } from '@/lib/format';

const subscribe = (notify: () => void) => {
  const timer = setInterval(notify, 10000);
  window.addEventListener('focus', notify);
  document.addEventListener('visibilitychange', notify);
  return () => {
    clearInterval(timer);
    window.removeEventListener('focus', notify);
    document.removeEventListener('visibilitychange', notify);
  };
};

/** A calendar day can change even when no source publishes a new dataset revision. */
export function useCalendarToday(timeZone: string, serverToday: string) {
  const snapshot = useCallback(() => dateKey(new Date(), timeZone), [timeZone]);
  const serverSnapshot = useCallback(() => serverToday, [serverToday]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
