import { describe, expect, it, vi, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  canonicalTeam,
  openKickoff,
  openStatus,
  parseOpenFootball,
  OpenFootballProvider,
} from '@/services/football/providers/openfootball';
import { mergeOpenMatch } from '@/services/football/openfootball-sync';
import {
  affectsResults,
  affectsPredictions,
  secondaryDue,
  secondaryProvider,
  syncSecondary,
} from '@/services/football/secondary';
import { quotaCeiling } from '@/services/football/quota';
import type { Match } from '@/types/football';
const row = {
  team1: 'Paris SG',
  team2: 'Marseille',
  date: '2026-09-13',
  time: '20:45',
  round: 'Matchday 4',
  score: { ft: [2, 1] },
};
const document = (matches: unknown[]) => ({ name: 'French Ligue 1 2026/27', matches });
const match: Match = {
  id: 'id',
  slug: 'id',
  competitionId: 'c',
  homeId: 'h',
  awayId: 'a',
  kickoff: '2026-09-13T18:45:00Z',
  status: 'scheduled',
  homeScore: null,
  awayScore: null,
  round: '4',
  events: [],
  lineups: [],
  statistics: [],
  source: 'openfootball',
  updatedAt: '2026-09-13T12:00:00Z',
};
afterEach(() => vi.unstubAllEnvs());
describe('OpenFootball : normalisation, identité et priorités', () => {
  it('importe les deux formats de score', () => {
    const first = parseOpenFootball(document([row]), 'fr.1', 2026).matches[0];
    const second = parseOpenFootball(document([{ ...row, score: [2, 1] }]), 'fr.1', 2026)
      .matches[0];
    expect(first).toEqual(second);
    expect(first.status).toBe('finished');
    expect(first.kickoff).toBe('2026-09-13T18:45:00.000Z');
  });
  it('conserve une identité lors du report et changement de journée', () => {
    const a = parseOpenFootball(document([row]), 'fr.1', 2026).matches[0];
    const b = parseOpenFootball(
      document([{ ...row, date: '2026-10-13', round: 'Replayed' }]),
      'fr.1',
      2026,
    ).matches[0];
    expect(a.externalId).toBe(b.externalId);
    expect(a.kickoff).not.toBe(b.kickoff);
  });
  it('rejette les doublons ambigus au lieu d’écraser un match', () => {
    expect(() =>
      parseOpenFootball(document([row, { ...row, date: '2026-10-13' }]), 'fr.1', 2026),
    ).toThrow('DUPLICATE_FIXTURE');
  });
  it.each([
    { ...row, date: '2026-02-30' },
    { ...row, time: '25:30' },
    { ...row, team2: 'PSG' },
    { ...row, score: [-1, 3] },
    { ...row, score: [1.5, 2] },
  ])('rejette une ligne incohérente : %j', (invalid) => {
    expect(() => parseOpenFootball(document([invalid]), 'fr.1', 2026)).toThrow();
  });
  it('normalise uniquement les variantes connues, pas Manchester ou les équipes B', () => {
    expect(canonicalTeam('PSG')).toBe(canonicalTeam('Paris Saint-Germain FC'));
    expect(canonicalTeam('Manchester United')).not.toBe(canonicalTeam('Manchester City'));
    expect(canonicalTeam('Barcelona B')).not.toBe(canonicalTeam('Barcelona'));
  });
  it('stocke UTC avec changements été/hiver et heure manquante explicite', () => {
    expect(openKickoff('2026-01-12', '20:45', 'Europe/Paris').kickoff).toBe(
      '2026-01-12T19:45:00.000Z',
    );
    expect(openKickoff('2026-08-12', '20:45', 'Europe/London').kickoff).toBe(
      '2026-08-12T19:45:00.000Z',
    );
    expect(openKickoff('2026-08-12', null, 'Europe/Paris').kickoffKnown).toBe(false);
  });
  it('ne déduit pas un direct d’une date ni d’un statut statique', () => {
    expect(openStatus('live', false)).toBe('scheduled');
    expect(openStatus('abandoned', false)).toBe('abandoned');
    expect(openStatus('postponed', false)).toBe('postponed');
  });
  it('préserve le direct, ses détails et sa source lors d’un import statique', () => {
    const live: Match = {
      ...match,
      status: 'live',
      source: 'api-football',
      minute: 62,
      homeScore: 1,
      awayScore: 0,
      statistics: [{ label: 'Possession', home: 60, away: 40 }],
      provenance: { schedule: 'openfootball', details: 'api-football' },
    };
    expect(mergeOpenMatch(live, match)).toMatchObject({
      status: 'live',
      minute: 62,
      homeScore: 1,
      statistics: live.statistics,
      source: 'api-football',
    });
  });
  it('préserve aussi un direct confirmé par FotMob sur une source calendrier OpenFootball', () => {
    const live: Match = {
      ...match,
      status: 'live',
      source: 'openfootball',
      minute: 71,
      homeScore: 2,
      awayScore: 1,
    };
    expect(mergeOpenMatch(live, match)).toMatchObject({
      status: 'live',
      minute: 71,
      homeScore: 2,
      awayScore: 1,
    });
  });
  it('met à jour les résultats OpenFootball corrigés', () => {
    expect(
      mergeOpenMatch(
        { ...match, status: 'finished', homeScore: 1 },
        { ...match, status: 'finished', homeScore: 2 },
      ).homeScore,
    ).toBe(2);
  });
});
describe('Accès externe borné', () => {
  it('ignore les minutes et buts live dans le recalcul historique', () => {
    const live: Match = { ...match, status: 'live', homeScore: 0, awayScore: 0 };
    const updated: Match = { ...live, minute: 60, homeScore: 1 };
    expect(affectsResults(live, updated)).toBe(false);
    expect(affectsPredictions(live, updated)).toBe(false);
    expect(affectsResults(updated, { ...updated, status: 'finished' })).toBe(true);
  });
  it('recalcule après correction ou annulation d’un résultat final', () => {
    const finished: Match = { ...match, status: 'finished', homeScore: 1, awayScore: 0 };
    expect(affectsResults(finished, { ...finished, homeScore: 2 })).toBe(true);
    expect(affectsResults(finished, { ...finished, status: 'cancelled' })).toBe(true);
    expect(affectsResults(finished, { ...finished, minute: 95 })).toBe(false);
    expect(affectsPredictions(match, { ...match, kickoff: '2026-09-14T18:45:00Z' })).toBe(true);
  });
  it('revalide les fichiers avec ETag sans interpréter un corps vide', async () => {
    const transport = vi.fn().mockResolvedValue(new Response(null, { status: 304 }));
    const result = await new OpenFootballProvider(transport).season('fr.1', 2026, 'tag');
    expect(result.unchanged).toBe(true);
    expect(transport.mock.calls[0][1].headers).toEqual({ 'If-None-Match': 'tag' });
  });
  it('expose une panne temporaire au job, jamais un catalogue vide de remplacement', async () => {
    await expect(
      new OpenFootballProvider(vi.fn().mockResolvedValue(new Response('', { status: 503 }))).season(
        'fr.1',
        2026,
      ),
    ).rejects.toThrow('OPENFOOTBALL_HTTP_503');
  });
  it('désactive le secondaire sans clé, sans appeler le réseau ni PostgreSQL', async () => {
    vi.stubEnv('FOOTBALL_API_KEY', '');
    expect(secondaryProvider(vi.fn())).toBeNull();
    expect(await syncSecondary()).toMatchObject({ status: 'disabled', requests: 0 });
  });
  it('réserve les derniers 20% du quota au direct', () => {
    expect(quotaCeiling('normal', 100)).toBe(80);
    expect(quotaCeiling('live', 100)).toBe(100);
  });
  it('ne rafraîchit pas une donnée fraîche, un futur lointain ou une heure inconnue', () => {
    const now = Date.parse(match.kickoff);
    expect(secondaryDue({ ...match, detailsUpdatedAt: new Date(now).toISOString() }, now)).toBe(
      false,
    );
    expect(secondaryDue(match, now - 86400000)).toBe(false);
    expect(secondaryDue({ ...match, kickoffKnown: false }, now)).toBe(false);
    expect(secondaryDue({ ...match, status: 'live' }, now)).toBe(true);
  });
});
