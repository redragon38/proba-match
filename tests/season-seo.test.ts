import { afterEach, expect, it, vi } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { indexablePaths } from '@/lib/seo';
import { contentModificationIndex } from '@/lib/sitemap-lastmod';
const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/services/football', () => ({ getDataset: state.get }));
vi.mock('@/services/predictions', () => ({ getPredictions: vi.fn() }));
import { generateMetadata } from '@/app/competition/[slug]/page';
import { generateMetadata as matchCatalogueMetadata } from '@/app/matchs/page';
afterEach(() => vi.unstubAllEnvs());

it('indexes documented historical seasons with distinct canonical URLs and dates', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://proba-match.com');
  const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
  data.source = 'openfootball';
  const c = data.competitions[0],
    base = data.matches.find((m) => m.competitionId === c.id)!;
  data.matches = [
    {
      ...base,
      season: c.season,
      status: 'finished',
      homeScore: 1,
      awayScore: 0,
      resultObservedAt: '2026-09-10T00:00:00Z',
    },
    {
      ...base,
      id: 'old',
      slug: 'old',
      season: c.season - 1,
      status: 'finished',
      homeScore: 2,
      awayScore: 0,
      resultObservedAt: '2026-09-11T00:00:00Z',
    },
  ];
  state.get.mockResolvedValue(data);
  const path = '/competition/' + c.slug + '?saison=' + (c.season - 1);
  const meta = await generateMetadata({
    params: Promise.resolve({ slug: c.slug }),
    searchParams: Promise.resolve({ saison: String(c.season - 1) }),
  });
  expect(meta.alternates?.canonical).toBe('https://proba-match.com' + path);
  expect(meta.robots).toMatchObject({ index: true });
  expect(meta.title).toContain(String(c.season - 1));
  expect(indexablePaths(data)).toContain(path);
  const dates = contentModificationIndex(data);
  expect(dates.get(path)).toBe('2026-09-11T00:00:00Z');
  expect(dates.get('/competition/' + c.slug)).toBe('2026-09-10T00:00:00Z');
  const missing = await generateMetadata({
    params: Promise.resolve({ slug: c.slug }),
    searchParams: Promise.resolve({ saison: '1900' }),
  });
  expect(missing.robots).toMatchObject({ index: false });
});

it('self-canonicalizes the complete match pagination and excludes filters and invalid pages', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://proba-match.com');
  const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
  data.source = 'openfootball';
  state.get.mockResolvedValue(data);
  const meta = await matchCatalogueMetadata({ searchParams: Promise.resolve({ page: '2' }) });
  expect(meta.alternates?.canonical).toBe('https://proba-match.com/matchs?page=2');
  expect(meta.title).toContain('page 2');
  expect(meta.robots).toMatchObject({ index: true });
  expect(indexablePaths(data)).toContain('/matchs?page=2');
  const filtered = await matchCatalogueMetadata({
    searchParams: Promise.resolve({ statut: 'finished' }),
  });
  expect(filtered.robots).toMatchObject({ index: false });
  await expect(
    matchCatalogueMetadata({ searchParams: Promise.resolve({ page: '999999' }) }),
  ).rejects.toThrow();
  await expect(
    matchCatalogueMetadata({ searchParams: Promise.resolve({ page: '1e0' }) }),
  ).rejects.toThrow();
});
