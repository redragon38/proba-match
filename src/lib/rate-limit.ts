export class WindowLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  constructor(
    private limit = 10,
    private windowMs = 600000,
    private maxKeys = 5000,
  ) {}
  take(key: string, now = Date.now()) {
    const entry = this.entries.get(key);
    if (entry && entry.until > now) {
      entry.count++;
      return entry.count <= this.limit;
    }
    if (this.entries.size >= this.maxKeys) {
      for (const [k, v] of this.entries) if (v.until <= now) this.entries.delete(k);
      if (this.entries.size >= this.maxKeys) return false;
    }
    this.entries.set(key, { count: 1, until: now + this.windowMs });
    return true;
  }
}
