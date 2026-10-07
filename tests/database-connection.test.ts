import { describe, expect, it } from 'vitest';
import { runtimeDatabaseUrl } from '@/database/connection';
describe('Prisma runtime connection limits', () => {
  it('limits each Vercel PostgreSQL pool without changing identity or SSL', () => {
    const input =
      'postgres://fixture:p%40ss@db.example:16780/defaultdb?sslmode=require&schema=public&connection_limit=8';
    const url = new URL(runtimeDatabaseUrl(input, true)!);
    expect(url.searchParams.get('connection_limit')).toBe('1');
    expect(url.searchParams.get('pool_timeout')).toBe('10');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('schema')).toBe('public');
    expect(url.username).toBe('fixture');
    expect(url.password).toBe('p%40ss');
    expect(url.port).toBe('16780');
    expect(url.pathname).toBe('/defaultdb');
  });
  it('preserves explicit timeout, local clients and non-PostgreSQL drivers', () => {
    expect(
      new URL(
        runtimeDatabaseUrl('postgresql://db.example/defaultdb?pool_timeout=15', true)!,
      ).searchParams.get('pool_timeout'),
    ).toBe('15');
    for (const value of [undefined, 'test', 'prisma://fixture', 'postgres://localhost/test']) {
      expect(runtimeDatabaseUrl(value, false)).toBe(value);
    }
    expect(runtimeDatabaseUrl('prisma://fixture', true)).toBe('prisma://fixture');
    expect(runtimeDatabaseUrl('test', true)).toBe('test');
  });
});
