'use client';
import { useEffect, useState } from 'react';
import type { Match } from '@/types/football';

const matchStatuses = new Set<Match['status']>([
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled',
  'abandoned',
]);
type LivePatch = Pick<Match, 'id' | 'status' | 'homeScore' | 'awayScore' | 'minute' | 'updatedAt'> & {
  extra?: number | null;
  phase?: 'halftime' | 'playing';
};
function livePatch(value: unknown): LivePatch | undefined {
  if (!value || typeof value !== 'object') return;
  const row = value as Record<string, unknown>;
  const nullableNumber = (field: unknown) =>
    field === null || (typeof field === 'number' && Number.isFinite(field));
  if (
    typeof row.id !== 'string' ||
    typeof row.status !== 'string' ||
    !matchStatuses.has(row.status as Match['status']) ||
    !nullableNumber(row.homeScore) ||
    !nullableNumber(row.awayScore) ||
    !nullableNumber(row.minute) ||
    (row.extra !== undefined && !nullableNumber(row.extra)) ||
    (row.phase !== undefined && row.phase !== 'halftime' && row.phase !== 'playing') ||
    typeof row.updatedAt !== 'string'
  )
    return;
  return row as LivePatch;
}
export function useLive(initial: Match[], detail = false) {
  const [updates, setUpdates] = useState<Record<string, Partial<Match>>>({});
  const [changed, setChanged] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>();
  const [subscriptionTime] = useState(Date.now);
  const ids = initial
    .toSorted(
      (a, b) =>
        Number(b.status === 'live') - Number(a.status === 'live') ||
        Math.abs(Date.parse(a.kickoff) - subscriptionTime) -
          Math.abs(Date.parse(b.kickoff) - subscriptionTime),
    )
    .slice(0, 100)
    .map((m) => m.id)
    .sort()
    .join(',');
  useEffect(() => {
    const liveInterval = 10_000;
    let stopped = false,
      busy = false,
      failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const previous = new Map<string, string>();
    for (const m of initial) previous.set(m.id, `${m.status}:${m.homeScore}:${m.awayScore}`);
    async function poll() {
      if (stopped || busy || !ids) return;
      if (document.visibilityState !== 'visible') {
        timer = setTimeout(poll, 30_000);
        return;
      }
      controller = new AbortController();
      busy = true;
      const activeController = controller;
      const timeout = setTimeout(() => activeController.abort(), 12000);
      try {
        const response = await fetch(
          `/api/live?ids=${encodeURIComponent(ids)}${detail ? '&detail=1' : ''}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        if (!response.ok) throw new Error('Unavailable');
        const payload = await response.json();
        if (!Array.isArray(payload.matches)) throw new Error('Invalid response');
        const next: Record<string, Partial<Match>> = {},
          changedIds: string[] = [];
        for (const row of payload.matches) {
          const m = livePatch(row);
          if (!m) continue;
          const signature = `${m.status}:${m.homeScore}:${m.awayScore}`;
          if (previous.has(m.id) && previous.get(m.id) !== signature) changedIds.push(m.id);
          previous.set(m.id, signature);
          next[m.id] = {
            ...m,
            ...(detail
              ? {
                  events: row.events,
                  statistics: row.statistics,
                  lineups: row.lineups,
                  performances: row.performances,
                }
              : { events: row.events }),
          };
        }
        if (!stopped) {
          setUpdates(next);
          setChanged(changedIds);
          setError(false);
          setDegraded(payload.degraded === true);
          setCheckedAt(new Date().toISOString());
        }
        failures = 0;
      } catch {
        if (!stopped) {
          setError(true);
          failures++;
        }
      } finally {
        busy = false;
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(poll, Math.min(120_000, liveInterval * 2 ** failures));
      }
    }
    const resume = () => {
      if (document.visibilityState === 'visible') {
        if (busy) return;
        clearTimeout(timer);
        timer = setTimeout(poll, 500);
      }
    };
    // Quickly reconcile CDN HTML with the latest saved score after hydration.
    timer = setTimeout(poll, 1_000);
    document.addEventListener('visibilitychange', resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', resume);
    };
    // The subscription is keyed by match IDs, not by each refreshed score.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, detail]);
  return {
    matches: initial.map((m) =>
      updates[m.id] && Date.parse(updates[m.id].updatedAt!) >= Date.parse(m.updatedAt)
        ? { ...m, ...updates[m.id] }
        : m,
    ),
    changed,
    error,
    degraded,
    checkedAt,
  };
}
