import { describe, it, expect, vi, afterEach } from 'vitest';
import { isPreviewDeployment } from '@/lib/deployment';
import robots from '@/app/robots';
import {
  siteOrigin,
  publicPages,
  publicMetadata,
  catalogueMetadata,
  indexablePaths,
  matchIndexable,
  editorialPaths,
} from '@/lib/seo';
import {
  catalogDataset,
  teamDataset,
  competitionDataset,
  standingsView,
  comparisonView,
} from '@/services/football/read-model';
import { derivedStandings } from '@/services/derived-standings';
import { createDemoDataset } from '@/services/football/providers/mock';
import { teamSummary } from '@/services/statistics';

describe('SEO contract', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('prevents preview metadata from overriding noindex and omits its public sitemap', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(isPreviewDeployment()).toBe(true);
    expect(publicMetadata('/', true).robots).toEqual({ index: false, follow: false });
    expect(robots().sitemap).toBeUndefined();
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isPreviewDeployment()).toBe(false);
    expect(robots().sitemap).toContain('/sitemap.xml');
    expect(() => siteOrigin('http://localhost:3000')).toThrow();
    expect(() => siteOrigin('https://preview.vercel.app')).toThrow();
    expect(siteOrigin('https://proba-match.vercel.app')).toBe('https://proba-match.vercel.app');
    expect(siteOrigin('https://probamatch.com')).toBe('https://proba-match.vercel.app');
    vi.stubEnv('APP_ENV', 'staging');
    expect(isPreviewDeployment()).toBe(true);
  });
  it('normalizes one HTTPS origin and rejects credentials, paths and insecure public hosts', () => {
    expect(siteOrigin('https://football.example/')).toBe('https://football.example');
    expect(siteOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    for (const url of [
      'http://football.example',
      'https://a:b@football.example',
      'https://football.example/path',
      'https://football.example/?x=1',
    ])
      expect(() => siteOrigin(url)).toThrow();
  });
  it('gives every public static page unique titles, descriptions and matching social URLs', () => {
    const metadata = Object.keys(publicPages).map((path) => publicMetadata(path));
    expect(new Set(metadata.map((m) => m.title)).size).toBe(metadata.length);
    expect(new Set(metadata.map((m) => m.description)).size).toBe(metadata.length);
    for (const m of metadata) expect(m.openGraph?.url).toBe(m.alternates?.canonical);
  });
  it('self-canonicalizes paginated catalogues and keeps empty catalogues out of the index', () => {
    expect(String(catalogueMetadata('/equipes', 100, 2, true).alternates?.canonical)).toMatch(
      /\/equipes\?page=2$/,
    );
    expect(catalogueMetadata('/joueurs', 0, 1, true).robots).toMatchObject({ index: false });
  });
  it('uses the same eligibility rules for metadata and the complete sitemap', () => {
    const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
    expect(indexablePaths(data)).toEqual(editorialPaths);
    data.source = 'openfootball';
    data.players = [];
    const paths = indexablePaths(data);
    expect(paths).toContain('/live');
    expect(paths).not.toContain('/joueurs');
    expect(paths).not.toContain('/recherche');
    for (const m of data.matches)
      expect(paths.includes(`/match/${m.slug}`)).toBe(matchIndexable(m, data));
    expect(new Set(paths).size).toBe(paths.length);
  });
});
describe('Scoped client payloads', () => {
  const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
  it('precomputes identical comparison and historical standings without fixtures in the payload', () => {
    const id = data.teams[0].id;
    const expected = teamSummary(data, id);
    expect(comparisonView(data)[id].all).toEqual({ ...expected, matches: [], lastTen: [] });
    const view = standingsView(data);
    expect(view.data.matches).toEqual([]);
    for (const c of data.competitions) {
      const matches = data.matches.filter(
        (m) => m.competitionId === c.id && (m.season ?? c.season) === c.season,
      );
      expect(view.tables[`${c.id}:${c.season}:home`]).toEqual(
        derivedStandings(matches, c.id, 'home'),
      );
    }
  });
  it('removes unused catalogue fixtures while retaining all searchable entities', () => {
    const small = catalogDataset(data);
    expect(small.matches).toEqual([]);
    expect(small.teams).toEqual(data.teams);
    expect(
      small.players.map(({ id, slug, name, teamId, position }) => ({
        id,
        slug,
        name,
        teamId,
        position,
      })),
    ).toEqual(
      data.players.map(({ id, slug, name, teamId, position }) => ({
        id,
        slug,
        name,
        teamId,
        position,
      })),
    );
    expect(small.players.every((player) => !player.photo && !player.photoCredit)).toBe(true);
    expect(JSON.stringify(small).length).toBeLessThan(JSON.stringify(data).length / 2);
  });
  it('preserves complete team calculations and both sides of match history', () => {
    const ids = [data.teams[0].id, data.teams[1].id];
    const small = teamDataset(data, ids);
    for (const id of ids)
      expect(teamSummary(small, id, '2027-01-01')).toEqual(teamSummary(data, id, '2027-01-01'));
    expect(small.matches.every((m) => ids.includes(m.homeId) || ids.includes(m.awayId))).toBe(true);
  });
  it('preserves every season of the chosen competition', () => {
    const id = data.competitions[0].id;
    expect(competitionDataset(data, id).matches).toEqual(
      data.matches.filter((m) => m.competitionId === id),
    );
  });
});
