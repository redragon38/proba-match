import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  release: vi.fn(),
  renew: vi.fn(),
  client: vi.fn(),
  heartbeatRenew: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('@prisma/client', async (original) => ({
  ...(await original<typeof import('@prisma/client')>()),
  PrismaClient: mocks.client,
}));
vi.mock('@/database/client', () => ({
  db: {
    $queryRaw: mocks.acquire,
    syncRun: { create: mocks.create, update: mocks.update },
    syncLock: { deleteMany: mocks.release, updateMany: mocks.renew },
  },
}));
import { footballJob } from '@/services/football/jobs';
import { assertJobActive } from '@/services/football/lease-context';
beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'test');
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.client.mockImplementation(function () {
    return {
      syncLock: { updateMany: mocks.heartbeatRenew },
      $connect: mocks.connect,
      $disconnect: mocks.disconnect,
    };
  });
  mocks.connect.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.heartbeatRenew.mockResolvedValue({ count: 1 });
  mocks.acquire.mockResolvedValue([{ key: 'football' }]);
  mocks.release.mockResolvedValue({ count: 1 });
  mocks.update.mockResolvedValue({});
  mocks.create.mockResolvedValue({ id: 'run' });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe('Nettoyage des synchronisations', () => {
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
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it('renews through a reserved VPS connection while the main pool is unavailable', async () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://fixture.invalid/db?connection_limit=3');
    mocks.renew.mockRejectedValue(new Error('MAIN_POOL_BUSY'));
    await expect(
      footballJob('predictions', async () => {
        await vi.advanceTimersByTimeAsync(90_000);
        assertJobActive();
        return { status: 'success' };
      }),
    ).resolves.toEqual({ status: 'success' });
    expect(mocks.client).toHaveBeenCalledWith(
      expect.objectContaining({
        datasourceUrl: expect.stringContaining('connection_limit=1'),
      }),
    );
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.heartbeatRenew).toHaveBeenCalledTimes(4);
    expect(mocks.renew).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never publishes after a renewal detects that ownership was replaced', async () => {
    mocks.heartbeatRenew.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
    const publish = vi.fn();
    await expect(
      footballJob('predictions', async () => {
        await vi.advanceTimersByTimeAsync(30_000);
        assertJobActive();
        publish();
      }),
    ).rejects.toThrow('SYNC_FAILED');
    expect(publish).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'SYNC_LEASE_LOST' }),
      }),
    );
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });

  it('does not overlap slow renewals and drains the pending renewal before closing its connection', async () => {
    let finish: ((value: { count: number }) => void) | undefined;
    mocks.heartbeatRenew.mockResolvedValueOnce({ count: 1 }).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await footballJob('predictions', async () => {
      await vi.advanceTimersByTimeAsync(90_000);
      expect(mocks.heartbeatRenew).toHaveBeenCalledTimes(2);
      expect(mocks.disconnect).not.toHaveBeenCalled();
      finish!({ count: 1 });
      return { status: 'success' };
    });
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });

  it('releases ownership and closes the dedicated client when its connection fails', async () => {
    mocks.connect.mockRejectedValue(new Error('offline'));
    const work = vi.fn();
    await expect(footballJob('predictions', work)).rejects.toThrow('SYNC_FAILED');
    expect(work).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
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
