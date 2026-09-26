'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
/** Detect newly published datasets on every page, including initially empty lists.
 * router.refresh updates server props without a navigation or document reload. */
export function DataUpdates({ revision }: { revision?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let stopped = false,
      busy = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    async function check() {
      if (stopped || busy) return;
      if (document.visibilityState !== 'visible') {
        timer = setTimeout(check, 30000);
        return;
      }
      busy = true;
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
        if (!stopped) timer = setTimeout(check, 30000);
      }
    }
    const resume = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        void check();
      }
    };
    timer = setTimeout(check, 30000);
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
