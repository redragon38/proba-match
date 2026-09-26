export interface CacheValue<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}
/** Bounded memory SWR, with single-flight revalidation and no rejected background promise. */
export class MemoryCache {
  private entries = new Map<string, CacheValue<unknown>>();
  private pending = new Map<string, Promise<unknown>>();
  constructor(
    private max = 1000,
    private clock = Date.now,
  ) {}
  async get<T>(key: string, loader: () => Promise<T>, ttl: number, stale = ttl * 5): Promise<T> {
    const hit = this.entries.get(key) as CacheValue<T> | undefined;
    if (hit && hit.expiresAt > this.clock()) return hit.value;
    const refresh = () => {
      const running = this.pending.get(key) as Promise<T> | undefined;
      if (running) return running;
      const task = loader()
        .then((value) => {
          if (this.entries.size >= this.max) this.entries.delete(this.entries.keys().next().value!);
          this.entries.set(key, {
            value,
            expiresAt: this.clock() + ttl,
            staleUntil: this.clock() + ttl + stale,
          });
          return value;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, task);
      return task;
    };
    if (hit && hit.staleUntil > this.clock()) {
      void refresh().catch(() => undefined);
      return hit.value;
    }
    return refresh();
  }
  clear() {
    this.entries.clear();
  }
  get size() {
    return this.entries.size;
  }
}
export const cache = new MemoryCache();
export const CACHE_TTL = {
  live: 30_000,
  scheduled: 300_000,
  finished: 604_800_000,
  standings: 3_600_000,
  player: 21_600_000,
  history: 604_800_000,
};
