import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '@/services/cache';
describe('Cache partagé en mémoire', () => {
  it('coalesce les demandes simultanées', async () => {
    const c = new MemoryCache();
    const loader = vi.fn(async () => 42);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => c.get('same', loader, 1000)),
    );
    expect(results).toEqual(Array(10).fill(42));
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it('sert le stale puis met à jour sans exposer une erreur asynchrone', async () => {
    let clock = 0;
    const c = new MemoryCache(2, () => clock);
    expect(await c.get('x', async () => 1, 10, 100)).toBe(1);
    clock = 11;
    expect(
      await c.get(
        'x',
        async () => {
          throw Error('offline');
        },
        10,
        100,
      ),
    ).toBe(1);
    await new Promise((r) => setTimeout(r, 0));
    clock = 120;
    await expect(
      c.get(
        'x',
        async () => {
          throw Error('offline');
        },
        10,
        100,
      ),
    ).rejects.toThrow('offline');
  });
  it('borne le nombre d’entrées et peut invalider', async () => {
    const c = new MemoryCache(2);
    for (const key of ['a', 'b', 'c']) await c.get(key, async () => key, 1000);
    expect(c.size).toBe(2);
    c.clear();
    expect(c.size).toBe(0);
  });
});
