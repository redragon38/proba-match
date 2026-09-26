import { describe, expect, it, vi } from 'vitest';
import {
  nextOpenDeadline,
  openInterval,
  openRetry,
  openSyncLate,
  runWorkerLoop,
  type WorkerHeartbeat,
} from '@/services/football/worker-loop';

describe('Worker recovery and scheduling', () => {
  it('keeps publishing liveness during a long catch-up import', async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      let finish!: (result: { status: string }) => void;
      const heartbeat = vi
        .fn<(value: WorkerHeartbeat) => Promise<void>>()
        .mockResolvedValue(undefined);
      const loop = runWorkerLoop({
        now: Date.now,
        stopped: () => done,
        wait: async () => {},
        nextOpen: async () => Date.now(),
        open: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        secondary: async () => ({ status: 'success' }),
        secondaryEnabled: () => false,
        heartbeat,
        log: vi.fn(),
      });
      await vi.advanceTimersByTimeAsync(180000);
      expect(heartbeat).toHaveBeenCalledTimes(3);
      expect(heartbeat.mock.calls[2][0]).toMatchObject({ openStatus: 'running', cycle: 1 });
      done = true;
      finish({ status: 'success' });
      await loop;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('reports missing or overdue source checks without treating normal waiting as an outage', () => {
    const now = Date.now();
    expect(openSyncLate([], 1, 300000, now)).toBe(true);
    expect(openSyncLate([{ lastSyncedAt: new Date(now - openInterval) }], 1, 300000, now)).toBe(
      false,
    );
    expect(
      openSyncLate([{ lastSyncedAt: new Date(now - openInterval - 300001) }], 1, 300000, now),
    ).toBe(true);
  });
  it('keeps persisted deadlines through restart, instead of adding another six hours', () => {
    const now = Date.parse('2026-09-21T10:00:00Z');
    const sources = [{ lastSyncedAt: new Date(now - 5 * 3600000) }];
    expect(nextOpenDeadline(sources, 1, now)).toBe(now + 3600000);
    expect(nextOpenDeadline(sources, 1, now + 1800000)).toBe(now + 3600000);
    expect(nextOpenDeadline([], 1, now)).toBe(now);
  });
  it('continues after provider and heartbeat errors, then automatically succeeds twice', async () => {
    let now = Date.parse('2026-09-21T10:00:00Z'),
      cycles = 0;
    const open = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ status: 'success' });
    const heartbeat = vi
      .fn()
      .mockRejectedValueOnce(new Error('DB offline'))
      .mockResolvedValue(undefined);
    const log = vi.fn();
    await runWorkerLoop({
      now: () => now,
      stopped: () => cycles >= 3,
      wait: async (ms) => {
        expect(ms).toBe(60000);
        now += cycles === 1 ? openRetry : openInterval;
      },
      nextOpen: async () => now,
      open,
      secondaryEnabled: () => true,
      secondary: async () => {
        cycles++;
        if (cycles === 1) throw new Error('secondary offline');
        return { status: 'success' };
      },
      heartbeat,
      log,
    });
    expect(open).toHaveBeenCalledTimes(3);
    expect(heartbeat).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledWith('WORKER_HEARTBEAT_FAILED', 1);
    expect(log).toHaveBeenCalledWith('OPENFOOTBALL_WORKER_FAILED', 1);
    expect(heartbeat.mock.calls.slice(1).every(([value]) => value.openStatus === 'success')).toBe(
      true,
    );
  });
  it('keeps the ordinary one-minute loop without refetching a source before its deadline', async () => {
    let now = Date.now(),
      cycles = 0;
    const deadline = now + openInterval,
      open = vi.fn();
    await runWorkerLoop({
      now: () => now,
      stopped: () => cycles === 2,
      wait: async (ms) => {
        now += ms;
      },
      nextOpen: async () => deadline,
      open,
      secondaryEnabled: () => false,
      secondary: vi.fn(),
      heartbeat: async (value) => {
        cycles++;
        expect(value.nextOpen).toBe(new Date(deadline).toISOString());
      },
      log: vi.fn(),
    });
    expect(open).not.toHaveBeenCalled();
  });
});
