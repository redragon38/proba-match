export const openInterval = 6 * 3600000;
export const openRetry = 3600000;
export function nextOpenDeadline(
  sources: { lastSyncedAt: Date | null }[],
  expected: number,
  now = Date.now(),
) {
  if (sources.length !== expected || sources.some((s) => !s.lastSyncedAt)) return now;
  return Math.min(...sources.map((s) => s.lastSyncedAt!.getTime() + openInterval));
}
export function openSyncLate(
  sources: { lastSyncedAt: Date | null }[],
  expected: number,
  grace: number,
  now = Date.now(),
) {
  return (
    sources.length !== expected ||
    sources.some((s) => !s.lastSyncedAt) ||
    now > nextOpenDeadline(sources, expected, now) + grace
  );
}
export type WorkerHeartbeat = {
  checkedAt: string;
  nextOpen: string;
  secondaryStatus: string;
  openStatus: string;
  cycle: number;
  intervalSeconds: number;
};
type Dependencies = {
  now: () => number;
  stopped: () => boolean;
  wait: (ms: number) => Promise<void>;
  nextOpen: () => Promise<number>;
  open: () => Promise<{ status: string }>;
  secondary: () => Promise<{ status: string }>;
  secondaryEnabled: () => boolean;
  heartbeat: (value: WorkerHeartbeat) => Promise<void>;
  log: (event: string, cycle: number) => void;
};

/** The same loop runs in production and isolated recovery tests; no job error ends it. */
export async function runWorkerLoop(deps: Dependencies) {
  let nextOpen = deps.now(),
    cycle = 0,
    openStatus = 'waiting',
    secondaryStatus = 'disabled';
  try {
    nextOpen = await deps.nextOpen();
  } catch {
    deps.log('WORKER_SCHEDULE_READ_FAILED', cycle);
  }
  let publishing = false;
  const publish = async () => {
    if (publishing) return;
    publishing = true;
    try {
      await deps.heartbeat({
        checkedAt: new Date(deps.now()).toISOString(),
        nextOpen: new Date(nextOpen).toISOString(),
        secondaryStatus,
        openStatus,
        cycle,
        intervalSeconds: 60,
      });
    } catch {
      deps.log('WORKER_HEARTBEAT_FAILED', cycle);
    } finally {
      publishing = false;
    }
  };
  // Catch-up imports can exceed two minutes; publish liveness while they run too.
  const pulse = setInterval(() => {
    void publish();
  }, 60000);
  try {
    while (!deps.stopped()) {
      const started = deps.now();
      cycle++;
      secondaryStatus = 'disabled';
      if (started >= nextOpen) {
        openStatus = 'running';
        try {
          const result = await deps.open();
          openStatus = result.status;
          // Derive the deadline from persisted source checks, including a skipped TTL import.
          nextOpen =
            result.status === 'success'
              ? Math.max(deps.now() + 60000, await deps.nextOpen())
              : deps.now() + openRetry;
        } catch {
          openStatus = 'failed';
          nextOpen = deps.now() + openRetry;
          deps.log('OPENFOOTBALL_WORKER_FAILED', cycle);
        }
      }
      try {
        if (deps.secondaryEnabled()) secondaryStatus = (await deps.secondary()).status;
      } catch {
        secondaryStatus = 'failed';
        deps.log('SECONDARY_WORKER_FAILED', cycle);
      }
      await publish();
      deps.log('WORKER_CYCLE_FINISHED', cycle);
      if (!deps.stopped()) await deps.wait(Math.max(0, 60000 - (deps.now() - started)));
    }
  } finally {
    clearInterval(pulse);
  }
}
