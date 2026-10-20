import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sources: vi.fn(), sync: vi.fn() }));
vi.mock('@/database/client', () => ({ db: { dataSource: { findMany: mocks.sources } } }));
vi.mock('@/services/football/openfootball-sync', async (original) => ({
  ...(await original<typeof import('@/services/football/openfootball-sync')>()),
  syncOpenFootball: mocks.sync,
}));
vi.mock('server-only', () => ({}));
import { ensurePredictionHistory } from '@/services/football/prediction-history';

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Prediction history bootstrap', () => {
  it('imports the missing previous season for configured leagues only, without repeated forecasts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    vi.stubEnv('OPENFOOTBALL_LEAGUES', 'fr.1,en.1');
    mocks.sources.mockResolvedValue([{ id: 'openfootball:en.1:2025' }]);
    mocks.sync.mockResolvedValue({ status: 'success', failures: 0 });
    expect(await ensurePredictionHistory()).toEqual({
      status: 'success',
      requested: 1,
      failures: 0,
    });
    expect(mocks.sync).toHaveBeenCalledWith({
      scopes: [{ league: 'fr.1', season: 2025 }],
      predictions: false,
    });
  });

  it('does not import a successfully loaded season again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    vi.stubEnv('OPENFOOTBALL_LEAGUES', 'fr.1');
    mocks.sources.mockResolvedValue([{ id: 'openfootball:fr.1:2025' }]);
    expect(await ensurePredictionHistory()).toEqual({ status: 'ready', requested: 0 });
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('uses the football season rather than the calendar year in January and retries absent sources', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-20T12:00:00Z'));
    vi.stubEnv('OPENFOOTBALL_LEAGUES', 'fr.1');
    mocks.sources.mockResolvedValue([]);
    mocks.sync.mockResolvedValue({ status: 'partial', failures: 1 });
    await ensurePredictionHistory();
    await ensurePredictionHistory();
    expect(mocks.sync).toHaveBeenCalledTimes(2);
    expect(mocks.sync).toHaveBeenLastCalledWith({
      scopes: [{ league: 'fr.1', season: 2025 }],
      predictions: false,
    });
  });
});
