import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('react', () => ({ cache: (fn: unknown) => fn }));
const getDataset = vi.hoisted(() => vi.fn());
vi.mock('@/services/football/index', () => ({ getDataset }));
import { getShellData } from '@/services/football/shell';

describe('Editorial shell during a database outage', () => {
  beforeEach(() => {
    getDataset.mockReset();
  });
  it('keeps navigation renderable without inventing football data', async () => {
    getDataset.mockRejectedValue(new Error('FOOTBALL_TEMPORARILY_UNAVAILABLE'));
    expect(await getShellData()).toEqual({
      revision: undefined,
      indexable: false,
      liveCount: 0,
      leagues: [],
    });
  });
  it('does not suppress unrelated programming errors', async () => {
    getDataset.mockRejectedValue(new TypeError('invalid snapshot'));
    await expect(getShellData()).rejects.toThrow('invalid snapshot');
  });
  it('preserves catalogue navigation and suppresses stale live counts', async () => {
    getDataset.mockResolvedValue({
      revision: 'known',
      source: 'espn',
      degraded: true,
      matches: [{ status: 'live' }],
      competitions: [
        { flag: 'FR', name: 'Ligue', slug: 'ligue', logo: '/logo.svg', other: 'ignored' },
      ],
    });
    expect(await getShellData()).toEqual({
      revision: 'known',
      indexable: true,
      liveCount: 0,
      leagues: [{ flag: 'FR', name: 'Ligue', slug: 'ligue', logo: '/logo.svg' }],
    });
  });
});
