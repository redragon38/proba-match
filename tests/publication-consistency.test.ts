import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { footballLease } from '@/services/football/lease-context';
const mocks = vi.hoisted(() => ({
  prior: vi.fn(),
  upsert: vi.fn(),
  removeEvents: vi.fn(),
  removeLineups: vi.fn(),
  removePlayers: vi.fn(),
  observations: vi.fn(),
  publish: vi.fn(),
  fence: vi.fn(),
}));
vi.mock('@/database/client', () => {
  const tx = {
    country: { upsert: mocks.upsert },
    competition: { upsert: mocks.upsert },
    season: { upsert: mocks.upsert },
    team: { upsert: mocks.upsert },
    venue: { upsert: mocks.upsert },
    coach: { upsert: mocks.upsert },
    player: { upsert: mocks.upsert },
    match: { findMany: mocks.prior, upsert: mocks.upsert },
    matchEvent: { deleteMany: mocks.removeEvents },
    matchLineup: { deleteMany: mocks.removeLineups, upsert: mocks.upsert },
    matchPlayer: { deleteMany: mocks.removePlayers, upsert: mocks.upsert },
    searchIndex: { upsert: mocks.upsert },
    resultObservation: { createMany: mocks.observations },
    cacheEntry: { upsert: mocks.publish },
    $queryRaw: mocks.fence,
  };
  return {
    db: { $transaction: async (callback: (value: typeof tx) => Promise<void>) => callback(tx) },
  };
});
import { persistDataset } from '@/services/football/persistence';
const initial = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const base = {
  ...initial.matches.find((m) => m.status === 'finished')!,
  resultPeriod: 'regulation' as const,
  neutralVenue: false,
  resultObservedAt: '2026-09-10T12:00:00Z',
};
function fixture() {
  return {
    ...initial,
    players: [],
    injuries: [],
    standings: {},
    matches: [{ ...base, neutralVenue: true, lineups: [], performances: [], events: [] }],
  };
}
describe('Publication consistency through a transaction adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prior.mockResolvedValue([{ id: base.id, payload: base }]);
    mocks.fence.mockResolvedValue([{ token: 'current', active: true }]);
  });
  it('removes withdrawn detail relations and persists a venue revision even with unchanged scores', async () => {
    const data = fixture(),
      changed = new Set<string>();
    await persistDataset(data, changed);
    expect(changed.has(base.id)).toBe(true);
    expect(mocks.removeLineups).toHaveBeenCalledWith({
      where: { matchId: base.id, teamId: { notIn: [] } },
    });
    expect(mocks.removePlayers).toHaveBeenCalledWith({
      where: { matchId: base.id, playerId: { notIn: [] } },
    });
    expect(mocks.observations.mock.calls[0][0].data).toHaveLength(2);
    expect(data.matches[0].resultRevisions?.map((r) => r.neutralVenue)).toEqual([false, true]);
    expect(mocks.publish).toHaveBeenCalledOnce();
  });
  it('never publishes or updates the caller dataset after a replaced lease is detected', async () => {
    mocks.fence.mockResolvedValue([{ token: 'other', active: true }]);
    const data = fixture(),
      before = structuredClone(data);
    await expect(
      footballLease.run({ token: 'current', lost: false }, () => persistDataset(data, new Set())),
    ).rejects.toThrow('SYNC_LEASE_LOST');
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(data).toEqual(before);
  });
});
