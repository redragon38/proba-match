import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  release: vi.fn(),
  renew: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    syncLock = { updateMany: mocks.renew };
    $disconnect = mocks.disconnect;
  },
}));
vi.mock('@/database/client', () => ({
  db: {
    $queryRaw: mocks.acquire,
    syncRun: { create: mocks.create, update: mocks.update },
    syncLock: { deleteMany: mocks.release, updateMany: mocks.renew },
  },
}));
import { footballJob } from '@/services/football/jobs';
beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'test');
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.acquire.mockResolvedValue([{ key: 'football' }]);
  mocks.release.mockResolvedValue({ count: 1 });
  mocks.update.mockResolvedValue({});
  mocks.create.mockResolvedValue({ id: 'run' });
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.renew.mockResolvedValue({ count: 1 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe('Nettoyage des synchronisations', () => {
  it('aborts publication when renewal loses ownership and closes its connection', async () => {
    mocks.renew.mockResolvedValue({ count: 0 });
    await expect(
      footballJob('test', async () => {
        await vi.advanceTimersByTimeAsync(30001);
        return { status: 'success' };
      }),
    ).rejects.toThrow('SYNC_FAILED');
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', errorCode: 'SYNC_LEASE_LOST' }),
      }),
    );
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });
  it('renews through a dedicated connection and closes it even without a lease', async () => {
    await footballJob('test', async () => {
      await vi.advanceTimersByTimeAsync(30001);
      expect(mocks.renew).toHaveBeenCalledOnce();
      return { status: 'success' };
    });
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    mocks.acquire.mockResolvedValue([]);
    await expect(footballJob('overlap', vi.fn())).rejects.toThrow('SYNC_ALREADY_RUNNING');
    expect(mocks.disconnect).toHaveBeenCalledTimes(2);
  });
  it('records imported players and a safe provider error code in the persisted job log', async () => {
    await footballJob('espn-players', async () => ({ players: 27, requests: 1 }));
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ matches: 27 }) }),
    );
    await expect(
      footballJob('espn', async () => {
        throw new Error('ESPN_HTTP_503');
      }),
    ).rejects.toThrow('SYNC_FAILED');
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorCode: 'ESPN_HTTP_503' }) }),
    );
  });
  it('allows the next job after a provider failure releases its lease', async () => {
    await expect(
      footballJob('test', async () => {
        throw new Error('provider');
      }),
    ).rejects.toThrow('SYNC_FAILED');
    expect(mocks.release).toHaveBeenCalledOnce();
    await expect(
      footballJob('test', async () => ({ status: 'success', requests: 1 })),
    ).resolves.toEqual({ status: 'success', requests: 1 });
    expect(mocks.release).toHaveBeenCalledTimes(2);
  });
  it('libère le verrou même si la création du journal échoue', async () => {
    mocks.create.mockRejectedValue(new Error('offline'));
    const work = vi.fn();
    await expect(footballJob('test', work)).rejects.toThrow('SYNC_FAILED');
    expect(work).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('ne libère jamais le verrou d’un autre worker', async () => {
    mocks.acquire.mockResolvedValue([]);
    await expect(footballJob('test', vi.fn())).rejects.toThrow('SYNC_ALREADY_RUNNING');
    expect(mocks.release).not.toHaveBeenCalled();
  });
  it('nettoie après une erreur métier même si le journal est indisponible', async () => {
    mocks.update.mockRejectedValue(new Error('offline'));
    await expect(
      footballJob('test', async () => {
        throw new Error('provider');
      }),
    ).rejects.toThrow('SYNC_FAILED');
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
