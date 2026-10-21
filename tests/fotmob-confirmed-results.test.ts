import { beforeEach, expect, it, vi } from 'vitest';
import observed from './fixtures/fotmob-confirmed-2026-10-19.json';
import { createDemoDataset } from '@/services/football/providers/mock';
import { parseFotmobMatches, identifyFotmobFixture } from '@/services/football/providers/fotmob';
import { applyFotmobListing } from '@/services/football/fotmob-live-state';
import { regulationResult } from '@/prediction-engine/result-period';
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  persist: vi.fn(),
  elo: vi.fn(),
  predictions: vi.fn(),
  listings: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => ({ db: { footballIdentity: { findMany: async () => [] } } }));
vi.mock('@/services/football/jobs', () => ({
  footballJob: async (_provider: string, work: () => Promise<unknown>) => work(),
}));
vi.mock('@/services/football/identities', () => ({ bindIdentity: async () => {} }));
vi.mock('@/services/football/local-store', () => ({ readLocalDataset: mocks.read }));
vi.mock('@/services/football/persistence', () => ({ persistMatchDetails: mocks.persist }));
vi.mock('@/services/football/rebuild-elo', () => ({ rebuildElo: mocks.elo }));
vi.mock('@/services/predictions', () => ({ persistPredictions: mocks.predictions }));
vi.mock('@/services/football/providers/fotmob', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/football/providers/fotmob')>()),
  FotmobProvider: class {
    requests = 1;
    matches = mocks.listings;
  },
}));
import { syncFotmobLive } from '@/services/football/fotmob-live-sync';
const now = new Date('2026-10-21T12:00:00Z');
beforeEach(() => vi.resetAllMocks());

it('identifies the three real pending matches uniquely and accepts only explicit FT results', () => {
  const rows = parseFotmobMatches(observed.listing);
  const template = createDemoDataset(now).matches[0];
  for (const pending of observed.pending) {
    const row = identifyFotmobFixture(rows, {
      kickoff: pending.kickoff,
      homeName: pending.names[0],
      awayName: pending.names[1],
    });
    expect(row).not.toBeNull();
    const updated = applyFotmobListing(
      {
        ...template,
        id: pending.id,
        kickoff: pending.kickoff,
        status: 'scheduled',
        source: 'openfootball',
        homeScore: null,
        awayScore: null,
      },
      row!,
      now.toISOString(),
    );
    expect(regulationResult(updated)).toMatchObject({
      homeScore: row!.home.score,
      awayScore: row!.away.score,
    });
    expect(
      identifyFotmobFixture([...rows, row!], {
        kickoff: pending.kickoff,
        homeName: pending.names[0],
        awayName: pending.names[1],
      }),
    ).toBeNull();
  }
});

it('persists a bounded recovery once, then refreshes ratings and archived evaluations', async () => {
  const data = createDemoDataset(now);
  const template = data.matches[0];
  data.matches = observed.pending.map((p, i) => ({
    ...template,
    id: p.id,
    kickoff: p.kickoff,
    status: 'scheduled',
    source: 'openfootball',
    homeScore: null,
    awayScore: null,
    homeId: `home-${i}`,
    awayId: `away-${i}`,
  }));
  data.teams = observed.pending.flatMap((p, i) =>
    p.names.map((name, j) => ({ ...data.teams[0], id: `${j === 0 ? 'home' : 'away'}-${i}`, name })),
  );
  mocks.read.mockResolvedValue(data);
  mocks.listings.mockResolvedValue(parseFotmobMatches(observed.listing));
  const first = await syncFotmobLive(now, { catchUp: true });
  expect(first).toMatchObject({
    status: 'success',
    matches: 3,
    requests: 1,
    unmatched: 0,
    resultsChanged: 3,
  });
  expect(mocks.persist).toHaveBeenCalledOnce();
  expect(mocks.elo).toHaveBeenCalledOnce();
  expect(mocks.predictions).toHaveBeenCalledOnce();
  expect(await syncFotmobLive(now, { catchUp: true })).toMatchObject({ matches: 0, requests: 0 });
  expect(mocks.listings).toHaveBeenCalledOnce();
  expect(mocks.persist).toHaveBeenCalledOnce();
});
