'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { dateKey } from '@/lib/format';
import { calendarTimeZone } from '@/lib/calendar-date';
/** Detect newly published datasets on every page, including initially empty lists.
 * router.refresh updates server props without a navigation or document reload. */
export function DataUpdates({ revision }: { revision?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const realtime =
      pathname === '/' ||
      pathname === '/live' ||
      pathname === '/matchs' ||
      pathname.startsWith('/match/');
    const catalogue = [
      '/joueurs',
      '/joueur/',
      '/equipes',
      '/equipe/',
      '/competitions',
      '/competition/',
      '/classements',
    ].some((path) => pathname === path || pathname.startsWith(path));
    // Editorial pages have no football payload to refresh. Catalogue data changes
    // far less often than scores, so avoid a full RSC render every 30 seconds there.
    if (pathname !== '/admin' && !realtime && !catalogue) return;
    const interval = realtime || pathname === '/admin' ? 30_000 : 300_000;
    let stopped = false,
      busy = false;
    const calendarDay = () =>
      dateKey(
        new Date(),
        calendarTimeZone(
          new URLSearchParams(window.location.search).get('timezone') ??
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        ),
      );
    let day = calendarDay();
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    async function check() {
      if (stopped || busy) return;
      if (document.visibilityState !== 'visible') {
        timer = setTimeout(check, interval);
        return;
      }
      busy = true;
      const currentDay = calendarDay();
      if (realtime && day !== currentDay) {
        day = currentDay;
        router.refresh(); // Preserve explicit URL filters while refreshing a new calendar day.
      }
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        if (pathname === '/admin') {
          router.refresh();
          return;
        }
        const response = await fetch('/api/updates', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.ok) {
          const body = await response.json();
          if (!stopped && typeof body.revision === 'string' && body.revision !== revision) {
            router.refresh();
          }
        }
      } catch {
        /* Keep the last rendered data. The next tick retries. */
      } finally {
        busy = false;
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(check, interval);
      }
    }
    const resume = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        void check();
      }
    };
    timer = setTimeout(check, interval);
    document.addEventListener('visibilitychange', resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', resume);
    };
  }, [revision, router, pathname]);
  return null;
}
