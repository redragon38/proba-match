import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findDatasetMarker: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => ({
  db: {
    cacheEntry: { findUnique: mocks.findDatasetMarker },
  },
}));

import { getDataset } from '@/services/football';
import { OpenFootballProvider } from '@/services/football/providers/openfootball';

describe('Dataset availability fallbacks', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://neon-unavailable.example/db');
    mocks.findDatasetMarker.mockRejectedValue(new Error('PrismaClientInitializationError'));
    vi.spyOn(OpenFootballProvider.prototype, 'season').mockRejectedValue(
      new Error('SOURCE_UNAVAILABLE'),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('serves a truthful empty dataset instead of throwing when the configured database is unreachable', async () => {
    const data = await getDataset();

    expect(data.matches).toEqual([]);
    expect(data.teams).toEqual([]);
    expect(data.warning).toContain('temporairement indisponibles');
  });
});
