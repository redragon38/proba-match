import { indexablePaths } from '@/lib/seo';
import { describe, it, expect } from 'vitest';
import { isoDate, isoDateTime, playerAge, playerBirthDate } from '@/lib/factual-dates';
import {
  structuredImage,
  teamStructuredData,
  playerStructuredData,
  matchStructuredData,
} from '@/lib/sports-structured-data';
import { matchFactSummary } from '@/lib/match-facts';
import { teamFactSummary } from '@/lib/team-facts';
import { createDemoDataset } from '@/services/football/providers/mock';
const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const match = data.matches[0];
const team = data.teams.find((t) => t.id === match.homeId)!;
const player = data.players[0];
describe('Factual sports identities and dates', () => {
  it('links event participants and player membership to the same canonical team identity', () => {
    const entity = teamStructuredData(team);
    const event = matchStructuredData(match, data)!;
    const athlete = playerStructuredData(player, team);
    expect(event.homeTeam['@id']).toBe(entity['@id']);
    expect(athlete.memberOf?.['@id']).toBe(entity['@id']);
    expect(event.homeTeam.url).toBe(entity.url);
    expect(event.mainEntityOfPage).toBe(event.url);
  });
  it('does not fabricate a time from the internal placeholder for an unknown kickoff', () => {
    const unknown = {
      ...match,
      kickoffKnown: false,
      sourceDate: '2026-09-10',
      kickoff: '2026-09-09T23:00:00Z',
    };
    expect(matchStructuredData(unknown, data)?.startDate).toBe('2026-09-10');
    expect(matchFactSummary(unknown, 'A', 'B', 'Ligue')).toContain('10 septembre 2026');
    const absent = { ...unknown, sourceDate: undefined };
    expect(matchStructuredData(absent, data)).not.toHaveProperty('startDate');
    expect(matchFactSummary(absent, 'A', 'B', 'Ligue')).toContain('date à confirmer');
  });
  it('refuses impossible dates and unconfirmed time zones', () => {
    for (const value of ['2026-02-30', '2026-13-01', 'bad']) expect(isoDate(value)).toBeUndefined();
    expect(isoDate('2024-02-29')).toBe('2024-02-29');
    for (const value of [
      '2026-02-30T10:00:00Z',
      '2026-10-05T24:00:00Z',
      '2026-10-05T12:00:00',
      'bad',
    ])
      expect(isoDateTime(value)).toBeUndefined();
    expect(matchFactSummary({ ...match, kickoff: 'bad' }, 'A', 'B', 'L')).not.toContain(
      'Invalid Date',
    );
    expect(
      matchFactSummary({ ...match, kickoff: '2026-02-30T10:00:00Z' }, 'A', 'B', 'L'),
    ).toContain('date à confirmer');
  });
  it('omits identities and statuses that are not supported by the available data', () => {
    expect(matchStructuredData(match, { ...data, teams: [] })).toBeNull();
    expect(matchStructuredData({ ...match, status: 'abandoned' }, data)).not.toHaveProperty(
      'eventStatus',
    );
    expect(matchStructuredData({ ...match, status: 'postponed' }, data)?.eventStatus).toMatch(
      /EventPostponed$/,
    );
    expect(
      playerStructuredData({ ...player, birthDate: '2999-01-01' }, undefined),
    ).not.toHaveProperty('birthDate');
    expect(playerStructuredData(player, undefined)).not.toHaveProperty('memberOf');
  });
  it('only includes public image URLs rather than unsafe or credential-bearing links', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'https://u:p@example.org/photo',
      '//external.example/logo',
      '/\\external.example/logo',
      'http://external.example/logo',
    ])
      expect(structuredImage(url)).toBeUndefined();
    expect(structuredImage('/icon.png')).toMatch(/\/icon.png$/);
    expect(structuredImage('https://example.org/logo.png')).toBe('https://example.org/logo.png');
  });
  it('counts completed birthdays and refuses missing or inconsistent reference data', () => {
    expect(playerAge('2000-10-06', '2026-10-05T12:00:00Z')).toBe(25);
    expect(playerAge('2000-10-06', '2026-10-06T12:00:00Z')).toBe(26);
    expect(playerAge('2000-02-29', '2026-02-28T12:00:00Z')).toBe(25);
    expect(playerAge('2000-02-29', '2026-03-01T12:00:00Z')).toBe(26);
    expect(playerAge('2027-01-01', '2026-10-05')).toBeUndefined();
    expect(playerAge('2000-01-01', 'bad')).toBeUndefined();
    expect(playerAge('2000-01-01', '2026-02-30')).toBeUndefined();
    expect(playerBirthDate('2027-01-01', '2026-10-05')).toBeUndefined();
  });
  it('keeps player pages with unresolved team identities out of the sitemap', () => {
    const broken = {
      ...data,
      source: 'openfootball' as const,
      players: [{ ...player, teamId: 'missing-team', stats: { ...player.stats, appearances: 10 } }],
    };
    expect(indexablePaths(broken)).not.toContain(`/joueur/${player.slug}`);
  });
  it('describes the available team history without claiming a complete season', () => {
    expect(teamFactSummary(team, { ...data, matches: [] })).toContain('Aucun résultat terminé');
    const text = teamFactSummary(team, {
      ...data,
      matches: [
        { ...match, status: 'finished', homeScore: 0, awayScore: 0 },
        { ...match, id: 'pending', status: 'scheduled', homeScore: null, awayScore: null },
      ],
    });
    expect(text).toContain('1 résultat terminé');
    expect(text).toContain('ne garantit pas un historique complet');
  });
});
