import { describe, expect, it } from 'vitest';
import { workerHealth } from '@/services/football/worker-health';
const heartbeat = {
  checkedAt: '2026-09-13T12:00:00.000Z',
  nextOpen: '2026-09-13T18:00:00.000Z',
  secondaryStatus: 'disabled',
};
describe('État du planificateur', () => {
  it('distinguishes ongoing catch-up, provider failure and stale worker', () => {
    const now = Date.parse(heartbeat.checkedAt);
    const catchingUp = {
      ...heartbeat,
      openStatus: 'running',
      nextOpen: new Date(now - 180000).toISOString(),
    };
    expect(workerHealth(catchingUp, now).status).toBe('RUNNING');
    expect(workerHealth({ ...catchingUp, openStatus: 'failed' }, now).status).toBe('DEGRADED');
    expect(workerHealth(catchingUp, now + 120001).status).toBe('STOPPED');
  });
  it('signale un worker arrêté après deux minutes sans signal', () => {
    expect(workerHealth(heartbeat, Date.parse(heartbeat.checkedAt) + 120000).state).toBe('active');
    expect(workerHealth(heartbeat, Date.parse(heartbeat.checkedAt) + 120001).state).toBe('late');
  });
  it('ne présente pas un signal manquant, invalide ou futur comme actif', () => {
    expect(workerHealth(null).state).toBe('unknown');
    expect(workerHealth({ ...heartbeat, checkedAt: 'invalide' }).state).toBe('unknown');
    expect(workerHealth(heartbeat, Date.parse(heartbeat.checkedAt) - 1).state).toBe('late');
  });
});
